import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { routeLeadToBranchFast, logRoutingActivity } from '@/lib/location/routing';
import { getActiveBranchesCached } from '@/lib/location/cache';
import { resolveLocation } from '@/lib/location/matcher';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { leadIds, force = false } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ success: true, updated: [] });
    }

    // Limit batch size to max 1000 leads at a time
    const safeLeadIds = leadIds
      .slice(0, 1000)
      .filter((id): id is number => typeof id === 'number' && id > 0);

    if (safeLeadIds.length === 0) {
      return NextResponse.json({ success: true, updated: [] });
    }

    // 1. Fetch active branches from in-memory cache (< 0.001ms)
    const activeBranches = await getActiveBranchesCached();
    if (activeBranches.length === 0) {
      return NextResponse.json(
        { error: 'No active dealership branches available for auto-assignment' },
        { status: 400 }
      );
    }

    const activeBranchNames = new Set<string>();
    activeBranches.forEach((b) => {
      const lower = b.name.toLowerCase().trim();
      activeBranchNames.add(lower);
      activeBranchNames.add(`sga motors ${lower}`);
      activeBranchNames.add(`sga ${lower}`);
      if (b.code) activeBranchNames.add(b.code.toLowerCase().trim());
    });
    const primaryBranch =
      activeBranches.find((b) => b.name.toLowerCase().includes('singanallur')) ||
      activeBranches[0];

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

    // 3. Process leads rapidly using fast in-memory routing (< 1ms per lead)
    for (const lead of targetLeads) {
      // Do not overwrite manual branch unless explicitly forced
      if (lead.isBranchManual && !force) {
        continue;
      }

      const currentBranchClean = (lead.branch || '').toLowerCase().trim();
      const hasValidBranch = currentBranchClean && activeBranchNames.has(currentBranchClean);

      // Skip if already assigned to a valid active branch unless forced
      if (hasValidBranch && !force) {
        continue;
      }

      const cleanCity = (lead.city || '').trim();

      try {
        const routeRes = await routeLeadToBranchFast(cleanCity, {
          candidateBranches: activeBranches,
        });

        const targetBranch =
          routeRes.status === 'assigned' && routeRes.assignedBranch
            ? routeRes.assignedBranch.name
            : '';

        if (targetBranch !== (lead.branch || '')) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { branch: targetBranch },
          });

          logRoutingActivity(lead.id, routeRes, currentUser.username || 'System').catch(
            console.error
          );

          updated.push({ id: lead.id, branch: targetBranch });
        }
      } catch (leadErr) {
        console.warn(`Fast routing error for lead ${lead.id}:`, leadErr);
      }
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('Leads geocode batch error:', error);
    return NextResponse.json(
      { error: 'Failed to process branch auto-assignment batch' },
      { status: 500 }
    );
  }
}
