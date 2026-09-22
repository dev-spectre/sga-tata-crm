import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { routeLeadToBranch, logRoutingActivity } from '@/lib/location/routing';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { leadIds } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ success: true, updated: [] });
    }

    // Limit batch size to max 50 leads at a time
    const safeLeadIds = leadIds.slice(0, 50).filter((id): id is number => typeof id === 'number' && id > 0);
    if (safeLeadIds.length === 0) {
      return NextResponse.json({ success: true, updated: [] });
    }

    // 1. Fetch active branches for distance ranking
    const activeBranches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        latitude: true,
        longitude: true,
        radiusKm: true,
        isActive: true,
      },
    });

    const activeBranchNames = new Set(activeBranches.map((b: { name: string }) => b.name.toLowerCase().trim()));

    // 2. Fetch requested leads
    const targetLeads = await prisma.lead.findMany({
      where: { id: { in: safeLeadIds } },
      select: {
        id: true,
        city: true,
        branch: true,
        isBranchManual: true,
      },
    });

    const updated: { id: number; branch: string }[] = [];

    // 3. Process leads sequentially in small controlled batch adhering to external geocoding rate limits
    for (const lead of targetLeads) {
      // Never auto-assign or overwrite branch if manually chosen by user
      if (lead.isBranchManual) {
        continue;
      }

      const currentBranchClean = (lead.branch || '').toLowerCase().trim();
      const hasValidBranch = currentBranchClean && activeBranchNames.has(currentBranchClean);

      // Skip if lead already has a valid branch
      if (hasValidBranch) {
        continue;
      }

      const cleanCity = (lead.city || '').trim();
      if (!cleanCity) {
        if (lead.branch) {
          await prisma.lead.update({ where: { id: lead.id }, data: { branch: '' } });
          updated.push({ id: lead.id, branch: '' });
        }
        continue;
      }

      try {
        // routeLeadToBranch:
        // Tier 1: In-memory dictionary (instant)
        // Tier 2: DB LocationCache lookup (instant)
        // Tier 3: Rate-limited external geocoder (1 req/sec) + automatic LocationCache DB persistence
        const routeRes = await routeLeadToBranch(cleanCity, {
          candidateBranches: activeBranches,
        });

        if (routeRes.status === 'assigned' && routeRes.assignedBranch) {
          const newBranch = routeRes.assignedBranch.name;
          await prisma.lead.update({
            where: { id: lead.id },
            data: { branch: newBranch },
          });
          await logRoutingActivity(lead.id, routeRes, 'System');
          updated.push({ id: lead.id, branch: newBranch });
        } else {
          // Out of state or unresolvable location: clear branch if invalid
          if (lead.branch) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { branch: '' },
            });
          }
          await logRoutingActivity(lead.id, routeRes, 'System');
          updated.push({ id: lead.id, branch: '' });
        }
      } catch (leadErr) {
        console.warn(`Geocode route error for lead ${lead.id}:`, leadErr);
      }
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('Leads geocode batch error:', error);
    return NextResponse.json(
      { error: 'Failed to process geocoding batch' },
      { status: 500 }
    );
  }
}
