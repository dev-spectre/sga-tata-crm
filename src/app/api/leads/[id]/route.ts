import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findAndWriteToSheetRow, findAndDeleteSheetRow } from '@/lib/google';
import { getCurrentUser } from '@/lib/auth';
import { logLeadDiff, checkLeadLockForUser, resolveLeadHandler, getCachedStaffUsers } from '@/lib/activity';
import { getCachedSettings } from '@/lib/settings';
import { setCachedLocation, getActiveBranchesCached } from '@/lib/location/cache';
import { normalizeKey } from '@/lib/location/tn-locations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    const body = await request.json();
    const {
      status,
      remark,
      followUpDate1,
      followUpDate2,
      newFollowUpDate,
      updateFollowUp,
      assignedConsultant,
      testDrive,
      branch,
      carModel,
      clearConsultant,
    } = body;
    
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

    const ensureExistingFollowUps = async () => {
      let existing = await prisma.leadFollowUp.findMany({
        where: { leadId },
        orderBy: { step: 'asc' },
      });
      if (existing.length === 0) {
        if (lead.followUpDate1) {
          await prisma.leadFollowUp.create({
            data: { leadId, step: 1, date: lead.followUpDate1 }
          });
        }
        if (lead.followUpDate2) {
          await prisma.leadFollowUp.create({
            data: { leadId, step: 2, date: lead.followUpDate2 }
          });
        }
        existing = await prisma.leadFollowUp.findMany({
          where: { leadId },
          orderBy: { step: 'asc' },
        });
      }
      return existing;
    };

    // 1. Appending a new follow-up step
    if (newFollowUpDate && typeof newFollowUpDate === 'string' && newFollowUpDate.trim()) {
      const existingFollowUps = await ensureExistingFollowUps();

      let currentMaxStep = 0;
      if (existingFollowUps.length > 0) {
        currentMaxStep = existingFollowUps[existingFollowUps.length - 1].step;
      }

      let nextStep = currentMaxStep + 1;
      if (typeof body.step === 'number' && body.step > currentMaxStep) {
        nextStep = body.step;
      }
      const parsedDate = new Date(`${newFollowUpDate.trim()}T12:00:00+05:30`);
      await prisma.leadFollowUp.create({
        data: {
          leadId,
          step: nextStep,
          date: parsedDate,
        }
      });

      const allFollowUps = await prisma.leadFollowUp.findMany({
        where: { leadId },
        orderBy: { step: 'asc' },
      });
      updateData.followUpCount = allFollowUps.length;
      updateData.followUpDate1 = allFollowUps[0]?.date || null;
      updateData.followUpDate2 = allFollowUps.length > 1 ? allFollowUps[allFollowUps.length - 1].date : null;
    }

    // 2. Editing or Clearing an existing follow-up step
    const stepToDelete = body.deleteFollowUpStep !== undefined
      ? Number(body.deleteFollowUpStep)
      : (updateFollowUp && typeof updateFollowUp === 'object' && updateFollowUp.step && (!updateFollowUp.date || !String(updateFollowUp.date).trim() || updateFollowUp.clear))
      ? Number(updateFollowUp.step)
      : null;

    if (stepToDelete !== null && !isNaN(stepToDelete)) {
      await ensureExistingFollowUps();
      await prisma.leadFollowUp.deleteMany({
        where: { leadId, step: stepToDelete },
      });

      const remaining = await prisma.leadFollowUp.findMany({
        where: { leadId },
        orderBy: { step: 'asc' },
      });

      // Re-index remaining steps to contiguous 1, 2, 3...
      for (let i = 0; i < remaining.length; i++) {
        const targetStep = i + 1;
        if (remaining[i].step !== targetStep) {
          await prisma.leadFollowUp.update({
            where: { id: remaining[i].id },
            data: { step: targetStep },
          });
          remaining[i].step = targetStep;
        }
      }

      const newCount = remaining.length;
      updateData.followUpCount = newCount;
      updateData.followUpDate1 = newCount > 0 ? remaining[0].date : null;
      updateData.followUpDate2 = newCount > 1 ? remaining[newCount - 1].date : null;
    } else if (updateFollowUp && typeof updateFollowUp === 'object' && updateFollowUp.step && updateFollowUp.date && String(updateFollowUp.date).trim()) {
      await ensureExistingFollowUps();
      const stepNum = Number(updateFollowUp.step);
      const parsedDate = new Date(`${String(updateFollowUp.date).trim()}T12:00:00+05:30`);
      const existingStep = await prisma.leadFollowUp.findFirst({
        where: { leadId, step: stepNum }
      });
      if (existingStep) {
        await prisma.leadFollowUp.update({
          where: { id: existingStep.id },
          data: { date: parsedDate }
        });
      } else {
        await prisma.leadFollowUp.create({
          data: { leadId, step: stepNum, date: parsedDate }
        });
      }
      const allFollowUps = await prisma.leadFollowUp.findMany({
        where: { leadId },
        orderBy: { step: 'asc' },
      });
      updateData.followUpCount = allFollowUps.length;
      updateData.followUpDate1 = allFollowUps[0]?.date || null;
      updateData.followUpDate2 = allFollowUps.length > 1 ? allFollowUps[allFollowUps.length - 1].date : null;
    }

    // 3. Fallback for explicit legacy followUpDate1 & followUpDate2
    if (followUpDate1 !== undefined && !newFollowUpDate && !updateFollowUp && body.deleteFollowUpStep === undefined) {
      if (!followUpDate1 || !String(followUpDate1).trim()) {
        await ensureExistingFollowUps();
        await prisma.leadFollowUp.deleteMany({ where: { leadId, step: 1 } });
        const remaining = await prisma.leadFollowUp.findMany({ where: { leadId }, orderBy: { step: 'asc' } });
        for (let i = 0; i < remaining.length; i++) {
          const targetStep = i + 1;
          if (remaining[i].step !== targetStep) {
            await prisma.leadFollowUp.update({ where: { id: remaining[i].id }, data: { step: targetStep } });
            remaining[i].step = targetStep;
          }
        }
        const newCount = remaining.length;
        updateData.followUpCount = newCount;
        updateData.followUpDate1 = newCount > 0 ? remaining[0].date : null;
        updateData.followUpDate2 = newCount > 1 ? remaining[newCount - 1].date : null;
      } else {
        const f1 = new Date(followUpDate1);
        updateData.followUpDate1 = f1;
        const existingF1 = await prisma.leadFollowUp.findFirst({ where: { leadId, step: 1 } });
        if (existingF1) {
          await prisma.leadFollowUp.update({ where: { id: existingF1.id }, data: { date: f1 } });
        } else {
          await prisma.leadFollowUp.create({ data: { leadId, step: 1, date: f1 } });
        }
        if ((lead.followUpCount || 0) < 1) updateData.followUpCount = 1;
      }
    }
    if (followUpDate2 !== undefined && !newFollowUpDate && !updateFollowUp && body.deleteFollowUpStep === undefined) {
      if (!followUpDate2 || !String(followUpDate2).trim()) {
        await ensureExistingFollowUps();
        await prisma.leadFollowUp.deleteMany({ where: { leadId, step: 2 } });
        const remaining = await prisma.leadFollowUp.findMany({ where: { leadId }, orderBy: { step: 'asc' } });
        for (let i = 0; i < remaining.length; i++) {
          const targetStep = i + 1;
          if (remaining[i].step !== targetStep) {
            await prisma.leadFollowUp.update({ where: { id: remaining[i].id }, data: { step: targetStep } });
            remaining[i].step = targetStep;
          }
        }
        const newCount = remaining.length;
        updateData.followUpCount = newCount;
        updateData.followUpDate1 = newCount > 0 ? remaining[0].date : null;
        updateData.followUpDate2 = newCount > 1 ? remaining[newCount - 1].date : null;
      } else {
        const f2 = new Date(followUpDate2);
        updateData.followUpDate2 = f2;
        const existingF2 = await prisma.leadFollowUp.findFirst({ where: { leadId, step: 2 } });
        if (existingF2) {
          await prisma.leadFollowUp.update({ where: { id: existingF2.id }, data: { date: f2 } });
        } else {
          await prisma.leadFollowUp.create({ data: { leadId, step: 2, date: f2 } });
        }
        if ((lead.followUpCount || 0) < 2) updateData.followUpCount = 2;
      }
    }
    if (assignedConsultant !== undefined) updateData.assignedConsultant = assignedConsultant?.trim() || null;
    if (clearConsultant === true) updateData.assignedConsultant = null;
    if (testDrive !== undefined) updateData.testDrive = testDrive;
    if (carModel !== undefined) {
      updateData.carModel = typeof carModel === 'string' ? carModel.trim() : '';
    }
    if (branch !== undefined) {
      const rawBranch = typeof branch === 'string' ? branch.trim() : '';
      const lowerRawBranch = rawBranch.toLowerCase().trim();
      const activeBranches = await getActiveBranchesCached();

      const matchedBranch = activeBranches.find((b) => {
        const bLower = b.name.toLowerCase().trim();
        const bCode = (b.code || '').toLowerCase().trim();
        return (
          bLower === lowerRawBranch ||
          (bCode && bCode === lowerRawBranch) ||
          `sga motors ${bLower}` === lowerRawBranch ||
          `sga ${bLower}` === lowerRawBranch ||
          lowerRawBranch.replace(/^sga\s+(motors\s+)?/i, '').trim() === bLower
        );
      });

      if (matchedBranch) {
        updateData.branch = matchedBranch.name;
      } else if (rawBranch === '' || lowerRawBranch === 'unassigned' || lowerRawBranch === 'other') {
        updateData.branch = '';
      } else {
        updateData.branch = rawBranch;
      }
      updateData.isBranchManual = true;

      // Smart Cache Feedback: Update LocationCache for lead.city so future auto-assignments route smartly
      const leadCity = (lead.city || '').trim();
      if (leadCity) {
        const normKey = normalizeKey(leadCity);
        if (normKey) {
          if (matchedBranch && typeof matchedBranch.latitude === 'number' && typeof matchedBranch.longitude === 'number') {
            setCachedLocation(normKey, {
              canonicalName: leadCity,
              district: matchedBranch.city || matchedBranch.name,
              state: 'Tamil Nadu',
              latitude: matchedBranch.latitude,
              longitude: matchedBranch.longitude,
              source: 'manual_override',
              isTamilNadu: true,
            }).catch((err) => console.warn('Failed to update LocationCache on manual branch edit:', err));
          } else if (updateData.branch === '') {
            setCachedLocation(normKey, {
              canonicalName: leadCity,
              district: '',
              state: 'Outside Tamil Nadu',
              latitude: 0,
              longitude: 0,
              source: 'manual_override',
              isTamilNadu: false,
            }).catch((err) => console.warn('Failed to update LocationCache on manual unassign edit:', err));
          }
        }
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        followUps: {
          select: { id: true, step: true, date: true, createdAt: true },
          orderBy: { step: 'asc' },
        },
      },
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
            else if (status === 'callback') formattedStatus = 'Callback';
            else if (status === 'live') formattedStatus = 'Completed';
            else if (status === 'lost') formattedStatus = 'Lost';
            else if (status === 'not_contacted') formattedStatus = 'Not Contacted';
            updates.push({ col: mapping.status, value: formattedStatus });
          }
          const finalF1 = updateData.followUpDate1 !== undefined ? updateData.followUpDate1 : (followUpDate1 !== undefined ? followUpDate1 : lead.followUpDate1);
          const finalF2 = updateData.followUpDate2 !== undefined ? updateData.followUpDate2 : (followUpDate2 !== undefined ? followUpDate2 : lead.followUpDate2);

          if ((updateData.followUpDate1 !== undefined || followUpDate1 !== undefined) && mapping.followUpDate1 !== undefined && mapping.followUpDate1 >= 0) {
            updates.push({ 
              col: mapping.followUpDate1, 
              value: finalF1 ? new Date(finalF1).toISOString().split('T')[0] : '' 
            });
          }
          if ((updateData.followUpDate2 !== undefined || followUpDate2 !== undefined) && mapping.followUpDate2 !== undefined && mapping.followUpDate2 >= 0) {
            updates.push({ 
              col: mapping.followUpDate2, 
              value: finalF2 ? new Date(finalF2).toISOString().split('T')[0] : '' 
            });
          }
          if (assignedConsultant !== undefined && mapping.assignedConsultant !== undefined && mapping.assignedConsultant >= 0) {
            updates.push({ col: mapping.assignedConsultant, value: assignedConsultant || '' });
          }
          if (clearConsultant === true && mapping.assignedConsultant !== undefined && mapping.assignedConsultant >= 0) {
            updates.push({ col: mapping.assignedConsultant, value: '' });
          }
          if (testDrive !== undefined && mapping.testDrive !== undefined) {
            updates.push({ col: mapping.testDrive, value: testDrive || '' });
          }
          if (branch !== undefined && mapping.branch !== undefined && mapping.branch >= 0) {
            updates.push({ col: mapping.branch, value: updateData.branch });
          }
          if (carModel !== undefined && mapping.carModel !== undefined && mapping.carModel >= 0) {
            updates.push({ col: mapping.carModel, value: updateData.carModel });
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

