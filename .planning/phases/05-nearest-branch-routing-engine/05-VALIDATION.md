# Phase 5: Nearest-Branch Routing Engine - Validation Plan

**Date:** 2026-09-12

## Verification Strategy

### Automated Verification
1. **Haversine Distance Accuracy**:
   - Coimbatore (11.0168, 76.9558) to Tiruppur (11.1085, 77.3411) must calculate to ~43-45 km.
   - Chennai (13.0827, 80.2707) to Madurai (9.9252, 78.1198) must calculate to ~415-425 km.
   - Distance from a point to itself must be 0 km.

2. **Nearest Branch Selection**:
   - Given branches in Chennai, Coimbatore, and Madurai:
     - A lead in "Peelamedu" (Coimbatore) routes to Coimbatore.
     - A lead in "Avadi" (Chennai) routes to Chennai.
     - A lead in "Dindigul" routes to Madurai (~55 km) over Chennai (~400 km).

3. **Inactive Branch Exclusion**:
   - If the closest branch is inactive (`isActive: false`), the routing engine must skip it and assign the next closest active branch.

4. **Out-of-State Lead Rejection**:
   - A lead in "Bangalore" or "Kochi" (Karnataka/Kerala) must NOT be assigned to any branch (`assignedBranch: null`, `branch: ""`, `isOutOfState: true`).

5. **Unresolvable Location Handling**:
   - A completely unknown string must not assign any branch (`assignedBranch: null`).

6. **Audit Log Recording**:
   - Verify that `logRoutingActivity` inserts a valid record in `prisma.leadActivity`.

## Acceptance Criteria
- `npx tsc --noEmit` exits with 0.
- `node --env-file=.env --test test/routing.test.mjs` exits with 0 and all assertions pass.
