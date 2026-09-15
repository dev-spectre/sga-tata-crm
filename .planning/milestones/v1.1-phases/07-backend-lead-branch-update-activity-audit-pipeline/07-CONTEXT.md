# Phase 7: Backend Lead Branch Update & Activity Audit Pipeline - Context

**Gathered:** 2026-09-15
**Status:** Ready for execution

<domain>
## Phase Boundary

Extends the core lead management API and activity audit system to allow direct manual branch re-assignment and consultant clearance:
1. `src/lib/activity.ts`: Add `branch` diffing to `LeadDiffPayload` and `logLeadDiff`, generating `BRANCH_CHANGE` audit entries with old and new branch values. Ensure Superadmin actions are completely invisible and never logged.
2. `src/app/api/leads/[id]/route.ts`: Expand `PATCH` handler to accept `branch`, optional `clearConsultant` (or explicit `assignedConsultant: null`), write changes to PostgreSQL, forward updates to Google Sheet if `mapping.branch` is mapped, and dispatch diff logging.
3. Audit integrity: Verify normal users generate audit logs, while Superadmin updates produce zero audit records.
</domain>

<decisions>
## Implementation Decisions

### Branch Field in Lead Patch Handler
- **D-01:** Direct Branch Mutation Support:
  - In `src/app/api/leads/[id]/route.ts`, extract `branch` and `clearConsultant` from request body.
  - Sanitize branch string (trim or convert empty to `""`).
  - If `clearConsultant === true` or `assignedConsultant === null`, set `updateData.assignedConsultant = null`.
  - Maintain lock check: if a lead is locked by a user, existing RBAC and lock protections apply. — **Reversibility:** reversible.

### Activity Diff & Superadmin Invisibility
- **D-02:** `BRANCH_CHANGE` Audit Action:
  - In `src/lib/activity.ts`, check `updates.branch !== undefined`.
  - If `previousLead.branch !== updates.branch`, push `{ action: 'BRANCH_CHANGE', oldValue: oldBranch || 'Unassigned', newValue: newBranch || 'Unassigned' }`.
  - Strictly uphold existing `isSuperAdminUser(user)` gate: if Superadmin performs the update, no `LeadActivity` records are generated. — **Reversibility:** irreversible policy requirement.

### Google Sheets Sync Forwarding
- **D-03:** Forward to Sheet When Mapped:
  - If `settings.columnMapping` contains `branch` and lead is not an external upload, forward updated branch to Google Sheets.
  - If consultant is cleared, clear sheet consultant column if mapped. — **Reversibility:** reversible.
</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — `BRCH-05`, `BRCH-06`
- `.planning/ROADMAP.md` — Phase 7 success criteria

### Target Modules
- `src/lib/activity.ts` — Activity diff tracking and Superadmin detection
- `src/app/api/leads/[id]/route.ts` — Lead PATCH endpoint
- `src/lib/google.ts` — Google Sheets writeback helper
</canonical_refs>
