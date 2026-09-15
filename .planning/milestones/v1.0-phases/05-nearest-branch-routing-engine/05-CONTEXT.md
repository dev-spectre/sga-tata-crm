# Phase 5: Nearest-Branch Routing Engine - Context

**Gathered:** 2026-09-12
**Status:** Ready for execution

<domain>
## Phase Boundary

Delivers the core geographic routing engine that computes geodesic distances between resolved lead coordinates and dealership branches, selects the geographically closest active branch, and records comprehensive audit trails in `LeadActivity`. Handles operational edge cases including inactive branch exclusion, catchment boundaries, and strict out-of-state lead protection.
</domain>

<decisions>
## Implementation Decisions

### Distance Computation
- **D-01:** Haversine Great-Circle Formula:
  $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \varphi}{2}\right) + \cos(\varphi_1)\cos(\varphi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
  Where $R = 6371\text{ km}$. Local, pure mathematical computation taking < 0.001ms per branch comparison with zero API costs. — **Reversibility:** reversible.

### Operational Branch Filtering
- **D-02:** Only evaluate branches where `isActive: true` with valid non-zero latitude and longitude coordinates. If a branch is marked paused or inactive in the Branches Management UI, leads must seamlessly route to the next nearest operational branch. — **Reversibility:** reversible.

### Out-of-State Lead Handling
- **D-03:** Strict Out-of-State Fencing:
  - If a lead's resolved location is outside Tamil Nadu / Puducherry (`isTamilNadu: false`), the engine MUST NOT assign the lead to an arbitrary branch.
  - Leaves `branch: ""` (unassigned) and marks `isOutOfState: true` for downstream highlighting in the CRM UI.
  - If location cannot be resolved (`matched: false`), leaves `branch: ""` and marks `unresolved: true`. — **Reversibility:** reversible.

### Audit Trail Logging
- **D-04:** `LeadActivity` Audit Entry:
  - Record routing decisions in the `LeadActivity` table with action `AUTO_ASSIGN_BRANCH`.
  - Details logged: Assigned branch name, distance in km, resolved location name/district, and resolution source (`dictionary`, `cache`, or `geocoder`). — **Reversibility:** reversible.
</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — `ROUTE-01`, `ROUTE-02`, `ROUTE-03`
- `.planning/ROADMAP.md` — Phase 5 success criteria

### Target Modules
- `src/lib/location/routing.ts` — Distance engine, branch selector, and routing resolver
- `src/lib/activity.ts` — Audit log integration
- `test/routing.test.mjs` — Automated unit and integration tests for routing logic
</canonical_refs>
