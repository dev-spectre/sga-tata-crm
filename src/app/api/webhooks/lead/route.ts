import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parsePhoneNumber, sanitizeField } from '@/lib/utils';
import { getCachedSettings } from '@/lib/settings';
import { checkAndNotify } from '@/lib/notifications';
import { routeLeadToBranch, logRoutingActivity } from '@/lib/location/routing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, city, adname, branch, followUpDate1, followUpDate2, remark } = body;
    
    const parsedName = (name || '').toString().trim();
    const rawPhone = (phone || '').toString().trim();
    const parsedPhone = parsePhoneNumber(rawPhone);
    const parsedCity = (city || '').toString().trim();
    const rawBranch = (branch || '').toString().trim();
    
    if (!parsedName && !parsedPhone && !parsedCity) {
      return NextResponse.json(
        { error: 'Lead must contain at least a name, phone, or city' },
        { status: 400 }
      );
    }
    
    const settings = await getCachedSettings();
    const sheetId = settings?.selectedSpreadsheetId || 'webhook';

    const nowIso = new Date().toISOString().slice(0, 10);
    const fingerprint = `${parsedPhone}|${nowIso}|0`;

    const existingLead = await prisma.lead.findFirst({
      where: {
        OR: [
          ...(fingerprint ? [{ fingerprint }] : []),
          ...(parsedPhone ? [{ phone: parsedPhone }] : [])
        ]
      }
    });

    if (existingLead) {
      return NextResponse.json({ success: true, lead: existingLead, duplicate: true });
    }

    // Nearest branch routing for inbound webhook leads
    let activeBranches: any[] = [];
    try {
      activeBranches = await prisma.branch.findMany({ where: { isActive: true } });
    } catch (err) {
      console.error('Failed to fetch active branches in webhook:', err);
    }
    const matchedBranch = activeBranches.find(
      (b) => b.name.toLowerCase() === rawBranch.toLowerCase().trim() ||
             (b.code && b.code.toLowerCase() === rawBranch.toLowerCase().trim())
    );
    let assignedBranch = matchedBranch ? matchedBranch.name : '';
    let routingResult = null;
    const locationInput = parsedCity || (body.zipcode || body.location || '').toString().trim();
    if (!assignedBranch && locationInput) {
      try {
        routingResult = await routeLeadToBranch(locationInput, { candidateBranches: activeBranches });
        if (routingResult.status === 'assigned' && routingResult.assignedBranch) {
          assignedBranch = routingResult.assignedBranch.name;
        }
      } catch (routeErr) {
        console.warn('Webhook auto-routing error:', routeErr);
      }
    }
    
    let lead;
    try {
      lead = await prisma.lead.create({
        data: {
          name: parsedName,
          phone: parsedPhone,
          city: parsedCity,
          adname: adname ? String(adname).trim() : '',
          branch: assignedBranch,
          followUpDate1: followUpDate1 ? new Date(followUpDate1) : null,
          followUpDate2: followUpDate2 ? new Date(followUpDate2) : null,
          remark: remark ? String(remark).trim() : null,
          status: 'pending',
          sheetId,
          fingerprint,
        },
      });

      if (routingResult) {
        logRoutingActivity(lead.id, routingResult, 'Webhook').catch(console.error);
      }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const found = await prisma.lead.findFirst({ where: { fingerprint } });
        return NextResponse.json({ success: true, lead: found, duplicate: true });
      }
      throw err;
    }

    // Trigger notification check immediately
    checkAndNotify().catch(console.error);
    
    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error('Lead webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to insert lead via webhook' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Lead Webhook endpoint active. Send POST with lead JSON to insert.' });
}
