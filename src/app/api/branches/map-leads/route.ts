import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { resolveLocation } from '@/lib/location/matcher';
import { isTamilNaduState, isWithinTamilNaduBounds, resolveLocationTiered } from '@/lib/location/geocoder';
import { calculateHaversineDistance, type BranchCandidate } from '@/lib/location/routing';

export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.isSuperAdmin);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Only Administrators can trigger automated branch mapping.' },
        { status: 403 }
      );
    }

    // 1. Fetch all active branches
    const activeBranches: BranchCandidate[] = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        latitude: true,
        longitude: true,
        isActive: true,
      },
    });

    const validBranches = activeBranches.filter(
      (b) => typeof b.latitude === 'number' && typeof b.longitude === 'number' && !(b.latitude === 0 && b.longitude === 0)
    );

    if (validBranches.length === 0) {
      return NextResponse.json(
        { error: 'No active dealership branches with valid GPS coordinates available.' },
        { status: 400 }
      );
    }

    // 2. Pre-fetch LocationCache into memory for fast lookup
    const cacheRows = await prisma.locationCache.findMany({
      select: {
        searchTerm: true,
        latitude: true,
        longitude: true,
        state: true,
      },
    });
    const cacheMap = new Map<string, { lat: number; lon: number; state: string }>();
    for (const row of cacheRows) {
      cacheMap.set(row.searchTerm.toLowerCase().trim(), {
        lat: row.latitude,
        lon: row.longitude,
        state: row.state,
      });
    }

    // 3. Fetch all leads that are not manually assigned
    const leads = await prisma.lead.findMany({
      where: {
        isBranchManual: false,
      },
      select: {
        id: true,
        city: true,
        branch: true,
      },
    });

    const branchToLeadIds = new Map<string, number[]>();
    branchToLeadIds.set('', []);
    for (const b of validBranches) {
      branchToLeadIds.set(b.name, []);
    }

    let assignedCount = 0;
    let outOfStateCount = 0;
    let unresolvableCount = 0;

    // 4. Map each lead: Tamil Nadu -> nearest active branch; outside Tamil Nadu -> unassigned ('')
    for (const lead of leads) {
      const rawCity = (lead.city || '').trim();
      if (!rawCity) {
        branchToLeadIds.get('')!.push(lead.id);
        unresolvableCount++;
        continue;
      }

      // Step A: Local TN Dictionary
      const dictMatch = resolveLocation(rawCity);
      let lat: number | null = null;
      let lon: number | null = null;
      let isTn = false;

      if (dictMatch && dictMatch.matched) {
        lat = dictMatch.latitude;
        lon = dictMatch.longitude;
        isTn = true;
      } else {
        // Step B: In-memory cache map
        const cached = cacheMap.get(rawCity.toLowerCase());
        if (cached) {
          lat = cached.lat;
          lon = cached.lon;
          isTn = isTamilNaduState(cached.state) || isWithinTamilNaduBounds(cached.lat, cached.lon);
        }
      }

      if (lat !== null && lon !== null) {
        if (!isTn) {
          // Out of state: keep unassigned
          branchToLeadIds.get('')!.push(lead.id);
          outOfStateCount++;
        } else {
          // In Tamil Nadu: find nearest branch across all of Tamil Nadu
          let minDistance = Infinity;
          let closestBranch = validBranches[0].name;

          for (const b of validBranches) {
            const dist = calculateHaversineDistance(lat, lon, b.latitude, b.longitude);
            if (dist < minDistance) {
              minDistance = dist;
              closestBranch = b.name;
            }
          }

          branchToLeadIds.get(closestBranch)!.push(lead.id);
          assignedCount++;
        }
      } else {
        // City unresolvable via local dictionary and cache
        branchToLeadIds.get('')!.push(lead.id);
        unresolvableCount++;
      }
    }

    // 5. Bulk execute updates in PostgreSQL grouped by target branch
    const distribution: Record<string, number> = {};
    const CHUNK_SIZE = 1000;

    for (const [branchName, ids] of branchToLeadIds.entries()) {
      distribution[branchName || 'Unassigned (Out of State / Unknown)'] = ids.length;
      if (ids.length === 0) continue;

      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        await prisma.lead.updateMany({
          where: { id: { in: chunk } },
          data: { branch: branchName },
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalLeads: leads.length,
      assigned: assignedCount,
      outOfState: outOfStateCount,
      unresolvable: unresolvableCount,
      distribution,
    });
  } catch (error: any) {
    console.error('Batch branch mapping error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to map leads to branches' },
      { status: 500 }
    );
  }
}
