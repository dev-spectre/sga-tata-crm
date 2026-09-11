# Phase 5: Nearest-Branch Routing Engine - Research

**Date:** 2026-09-12

## Objectives
- Research distance calculation algorithms for geospatial routing in Node.js/TypeScript.
- Establish best practices for database query performance when fetching active branch coordinates.
- Design clean audit log integration adhering to existing `LeadActivity` conventions.

## Findings

### 1. Haversine Distance Precision & Performance
- Earth mean radius: $6371.0 \text{ km}$.
- Haversine computes great-circle distance between two pairs of $(\text{lat}, \text{lon})$ coordinates.
- For regional distances across Tamil Nadu (~500 km maximum extent), Haversine is accurate to within 0.3% compared to ellipsoidal Vincenty/Geodesic algorithms, with execution speed > 10,000,000 calculations/second in V8.
- Trigonometric implementations in JavaScript:
  ```ts
  export function calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  ```

### 2. Active Branch Resolution
- Dealership branches are stored in the PostgreSQL `Branch` table. Typical dealership network size is 5 to 50 branches across Tamil Nadu.
- Query:
  ```ts
  const activeBranches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, city: true, latitude: true, longitude: true, radiusKm: true },
  });
  ```
- Filtering: Ignore any branch where `latitude === 0 && longitude === 0` or coordinates are null.
- Sorting: Map over active branches, calculate distance $d$, sort ascending by $d$. The first item is the nearest branch.

### 3. Out-of-State & Edge-Case Protection
- If `locationResult.isTamilNadu === false`:
  - Do NOT assign lead to any branch.
  - Return `{ assignedBranch: null, isOutOfState: true, reason: 'Lead location is outside Tamil Nadu' }`.
- If no active branches exist or no branches have valid coordinates:
  - Return `{ assignedBranch: null, isOutOfState: false, reason: 'No active branches available' }`.
- If location query is empty or failed resolution:
  - Return `{ assignedBranch: null, isOutOfState: false, reason: 'Location could not be resolved' }`.

### 4. Audit Log Integration in LeadActivity
- Existing `LeadActivity` fields:
  - `leadId`: Int
  - `userId`: Int? (null for system automated operations)
  - `username`: String ('System' or specific service user)
  - `action`: String ('AUTO_ASSIGN_BRANCH')
  - `oldValue`: String? (previous branch if any, or empty)
  - `newValue`: String? (`Assigned to ${branch.name} (${distance.toFixed(1)} km away via ${source})`)
