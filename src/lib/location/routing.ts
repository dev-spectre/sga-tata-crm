import { prisma } from '../prisma';
import { resolveLocationTiered } from './geocoder';

export interface BranchCandidate {
  id: number;
  name: string;
  code: string;
  city: string;
  latitude: number;
  longitude: number;
  radiusKm?: number | null;
  isActive: boolean;
}

export interface BranchDistance extends BranchCandidate {
  distanceKm: number;
}

export interface RoutingResolvedLocation {
  query: string;
  canonicalName: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  source: string;
}

export interface RoutingResult {
  assignedBranch: BranchCandidate | null;
  distanceKm: number | null;
  allBranchesRanked?: BranchDistance[];
  resolvedLocation: RoutingResolvedLocation | null;
  isOutOfState: boolean;
  isUnresolved: boolean;
  status: 'assigned' | 'out_of_state' | 'unresolved' | 'no_active_branches';
  reason: string;
}

export interface RoutingOptions {
  candidateBranches?: BranchCandidate[];
  skipExternalGeocode?: boolean;
}

/**
 * Calculates the great-circle distance between two pairs of coordinates
 * using the Haversine formula (Earth radius = 6371 km).
 * Returns distance in kilometers rounded to 2 decimal places.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Finds the nearest operational branch to the given lead coordinates.
 * Excludes inactive branches and branches with missing (0,0) coordinates.
 */
export async function findNearestBranch(
  leadLat: number,
  leadLon: number,
  candidateBranches?: BranchCandidate[]
): Promise<{
  nearestBranch: BranchCandidate | null;
  distanceKm: number | null;
  ranked: BranchDistance[];
}> {
  let branches: BranchCandidate[] = [];

  if (candidateBranches && candidateBranches.length > 0) {
    branches = candidateBranches;
  } else {
    try {
      branches = await prisma.branch.findMany({
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
    } catch (err) {
      console.error('Failed to fetch active branches from database:', err);
    }
  }

  // Filter for active branches with valid non-zero coordinates
  const validBranches = branches.filter((b) => {
    if (!b.isActive) return false;
    if (typeof b.latitude !== 'number' || typeof b.longitude !== 'number') return false;
    if (b.latitude === 0 && b.longitude === 0) return false;
    return true;
  });

  if (validBranches.length === 0) {
    return {
      nearestBranch: null,
      distanceKm: null,
      ranked: [],
    };
  }

  // Calculate Haversine distance for each branch and sort ascending
  const ranked: BranchDistance[] = validBranches
    .map((branch) => ({
      ...branch,
      distanceKm: calculateHaversineDistance(
        leadLat,
        leadLon,
        branch.latitude,
        branch.longitude
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearest = ranked[0];

  return {
    nearestBranch: nearest,
    distanceKm: nearest.distanceKm,
    ranked,
  };
}

/**
 * Full Pipeline: Resolves a lead's location query through the tiered resolver
 * and assigns the lead to the closest active branch.
 * Enforces strict out-of-state fence and unresolved rejection.
 */
export async function routeLeadToBranch(
  locationQuery: string,
  options?: RoutingOptions
): Promise<RoutingResult> {
  if (!locationQuery || typeof locationQuery !== 'string' || !locationQuery.trim()) {
    return {
      assignedBranch: null,
      distanceKm: null,
      resolvedLocation: null,
      isOutOfState: false,
      isUnresolved: true,
      status: 'unresolved',
      reason: 'Empty or missing location input',
    };
  }

  // 1. Resolve coordinates via Tiered Resolver (Dictionary -> DB Cache -> Geocoder)
  const locResult = await resolveLocationTiered(locationQuery.trim(), {
    skipExternal: options?.skipExternalGeocode,
  });

  // 2. Handle unresolved queries
  if (!locResult.matched) {
    return {
      assignedBranch: null,
      distanceKm: null,
      resolvedLocation: null,
      isOutOfState: false,
      isUnresolved: true,
      status: 'unresolved',
      reason: `Could not resolve geographical location from query "${locationQuery}"`,
    };
  }

  const resolvedMeta: RoutingResolvedLocation = {
    query: locResult.query,
    canonicalName: locResult.canonicalName,
    district: locResult.district,
    state: locResult.state,
    latitude: locResult.latitude,
    longitude: locResult.longitude,
    source: locResult.source,
  };

  // 3. Strict Out-of-State Rejection Fence
  // Never arbitrarily assign out-of-state leads to a Tamil Nadu branch
  if (!locResult.isTamilNadu) {
    return {
      assignedBranch: null,
      distanceKm: null,
      resolvedLocation: resolvedMeta,
      isOutOfState: true,
      isUnresolved: false,
      status: 'out_of_state',
      reason: `Location "${locResult.canonicalName}" (${locResult.state || 'Unknown State'}) is outside Tamil Nadu (out of state)`,
    };
  }

  // 4. Discover nearest active branch
  const { nearestBranch, distanceKm, ranked } = await findNearestBranch(
    locResult.latitude,
    locResult.longitude,
    options?.candidateBranches
  );

  if (!nearestBranch || distanceKm === null) {
    return {
      assignedBranch: null,
      distanceKm: null,
      allBranchesRanked: ranked,
      resolvedLocation: resolvedMeta,
      isOutOfState: false,
      isUnresolved: false,
      status: 'no_active_branches',
      reason: 'No active dealership branches available for geographical routing',
    };
  }

  return {
    assignedBranch: nearestBranch,
    distanceKm,
    allBranchesRanked: ranked,
    resolvedLocation: resolvedMeta,
    isOutOfState: false,
    isUnresolved: false,
    status: 'assigned',
    reason: `Assigned to ${nearestBranch.name} (${distanceKm} km away via ${locResult.source})`,
  };
}

/**
 * Records routing decision and distance into LeadActivity audit log.
 */
export async function logRoutingActivity(
  leadId: number,
  result: RoutingResult,
  username = 'System'
): Promise<void> {
  try {
    let action = 'ROUTING_INFO';
    let newValue = result.reason;

    if (result.status === 'assigned' && result.assignedBranch) {
      action = 'AUTO_ASSIGN_BRANCH';
      newValue = `Assigned to ${result.assignedBranch.name} (${result.distanceKm} km away via ${
        result.resolvedLocation?.source || 'location'
      })`;
    } else if (result.status === 'out_of_state') {
      action = 'ROUTING_OUT_OF_STATE';
      newValue = `Lead location "${result.resolvedLocation?.canonicalName || ''}" in ${
        result.resolvedLocation?.state || 'external state'
      } is out of state - unassigned`;
    } else if (result.status === 'unresolved') {
      action = 'ROUTING_UNRESOLVED';
      newValue = `Location could not be resolved - unassigned`;
    }

    await prisma.leadActivity.create({
      data: {
        leadId,
        username,
        action,
        oldValue: null,
        newValue,
      },
    });
  } catch (err) {
    console.error(`Failed to log routing activity for lead ${leadId}:`, err);
  }
}
