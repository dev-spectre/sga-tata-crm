import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findAndWriteToSheetRow, findAndDeleteSheetRow } from '@/lib/google';
import { getCurrentUser } from '@/lib/auth';
import { logLeadDiff, checkLeadLockForUser, resolveLeadHandler, getCachedStaffUsers } from '@/lib/activity';
import { getCachedSettings } from '@/lib/settings';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    const body = await request.json();
    const { status, remark, followUpDate1, followUpDate2, assignedConsultant, testDrive } = body;
    
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const currentUser = await getCurrentUser();

    // Server-level and DB-level lock enforcement:
    // If a normal user is handling this lead, only that user (or admins) can modify it.
    const lockCheck = await checkLeadLockForUser(leadId, currentUser);
    if (lockCheck.isLocked) {
      return NextResponse.json(
        { error: lockCheck.error || 'This lead is locked by another user', handledBy: lockCheck.handledBy },
        { status: 403 }
      );
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (remark !== undefined) updateData.remark = remark;
    if (followUpDate1 !== undefined) {
      updateData.followUpDate1 = followUpDate1 ? new Date(followUpDate1) : null;
    }
    if (followUpDate2 !== undefined) {
      updateData.followUpDate2 = followUpDate2 ? new Date(followUpDate2) : null;
    }
    if (assignedConsultant !== undefined) updateData.assignedConsultant = assignedConsultant;
    if (testDrive !== undefined) updateData.testDrive = testDrive;

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    // Log activity diff (skips superadmin automatically)
    await logLeadDiff({
      leadId,
      user: currentUser,
      previousLead: lead,
      updates: updateData,
    });
    
    // Wait for Google Sheet update only for primary sheet leads (never write back external uploads)
    if (lead.source !== 'External Upload' && lead.uploadedById === null) {
      try {
        const settings = await getCachedSettings();
        const spreadsheetId = lead.sheetId || settings?.selectedSpreadsheetId;
        const sheetName = settings?.selectedSheetName;

        if (spreadsheetId && sheetName && settings?.googleAccessToken) {
          const mapping = settings.columnMapping
            ? JSON.parse(settings.columnMapping)
            : { remark: 7, status: 8 };
          
          const updates: { col: number; value: string }[] = [];
          if (remark !== undefined && mapping.remark !== undefined) {
            updates.push({ col: mapping.remark, value: remark });
          }
          if (status !== undefined && mapping.status !== undefined) {
            let formattedStatus = status;
            if (status === 'pending') formattedStatus = 'Contacted';
            else if (status === 'live') formattedStatus = 'Completed';
            else if (status === 'lost') formattedStatus = 'Lost';
            else if (status === 'not_contacted') formattedStatus = 'Not Contacted';
            updates.push({ col: mapping.status, value: formattedStatus });
          }
          if (followUpDate1 !== undefined && mapping.followUpDate1 !== undefined) {
            updates.push({ 
              col: mapping.followUpDate1, 
              value: followUpDate1 ? new Date(followUpDate1).toISOString().split('T')[0] : '' 
            });
          }
          if (followUpDate2 !== undefined && mapping.followUpDate2 !== undefined) {
            updates.push({ 
              col: mapping.followUpDate2, 
              value: followUpDate2 ? new Date(followUpDate2).toISOString().split('T')[0] : '' 
            });
          }
          if (assignedConsultant !== undefined && mapping.assignedConsultant !== undefined) {
            updates.push({ col: mapping.assignedConsultant, value: assignedConsultant || '' });
          }
          if (testDrive !== undefined && mapping.testDrive !== undefined) {
            updates.push({ col: mapping.testDrive, value: testDrive || '' });
          }

          if (updates.length > 0) {
            await findAndWriteToSheetRow(spreadsheetId, sheetName, lead, updates);
          }
        }
      } catch (sheetError) {
        console.error('Failed to update Google Sheet in background:', sheetError);
      }
    }

    // Compute updated handler to return to client
    const superUsername = (process.env.SUPERADMIN_USERNAME || 'sudo').trim().toLowerCase();
    const [{ staffUsernames, staffUserById }, leadActivities] = await Promise.all([
      getCachedStaffUsers(),
      prisma.leadActivity.findMany({
        where: {
          leadId,
          username: { notIn: [superUsername, 'sudo'], mode: 'insensitive' },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          leadId: true,
          userId: true,
          username: true,
          action: true,
          oldValue: true,
          newValue: true,
          createdAt: true,
        },
      }),
    ]);

    const currentHandler = resolveLeadHandler(updatedLead, leadActivities, staffUsernames, staffUserById);

    return NextResponse.json({
      lead: {
        ...updatedLead,
        handledBy: currentHandler,
      },
    });
  } catch (error: any) {
    console.error('Lead update error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to update lead', details: error?.message || String(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    const searchParams = request.nextUrl.searchParams;
    const deleteFromSheet = searchParams.get('deleteFromSheet') === 'true';

    const currentUser = await getCurrentUser();
    const isSuper = currentUser && (currentUser.isSuperAdmin || currentUser.role === 'SUPERADMIN' || currentUser.username === (process.env.SUPERADMIN_USERNAME || 'sudo'));

    if (!isSuper) {
      return NextResponse.json({ error: 'Unauthorized. Only the Superadmin can delete leads.' }, { status: 403 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Superadmin permanently deletes the lead (only delete from sheet for primary sheet leads)
    if (deleteFromSheet && lead.source !== 'External Upload' && lead.uploadedById === null) {
      try {
        const settings = await getCachedSettings();
        const spreadsheetId = lead.sheetId || settings?.selectedSpreadsheetId;
        const sheetName = settings?.selectedSheetName;

        if (spreadsheetId && sheetName && settings?.googleAccessToken) {
          await findAndDeleteSheetRow(spreadsheetId, sheetName, lead);
        }
      } catch (sheetError) {
        console.error('Failed to delete Google Sheet row:', sheetError);
      }
    }

    await prisma.lead.delete({ where: { id: leadId } });

    return NextResponse.json({
      success: true,
      deletedId: leadId,
      deletedFromSheet: deleteFromSheet,
      isPermanent: true,
    });
  } catch (error) {
    console.error('Lead delete error:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}

