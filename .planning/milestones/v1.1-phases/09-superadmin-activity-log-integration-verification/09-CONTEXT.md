# Phase 9: Superadmin Activity Log Integration & Verification - Context

**Gathered:** 2026-09-15
**Status:** Ready for execution

<domain>
## Phase Boundary

Ensures branch changes made by staff users are cleanly presented in the Superadmin activity and audit viewer (`/activity`), while upholding complete Superadmin log suppression:
1. `src/app/activity/page.tsx`: Add `BRANCH_CHANGE` badge styling (`#059669`, "Branch Changed"), descriptive text formatter (`"Changed branch from 'Old' to 'New'"`), and filter option (`"Branch Changes"`).
2. End-to-end verification: Confirm branch changes made by standard users produce properly formatted logs in the viewer, and confirm Superadmin actions never appear anywhere in `/activity` or `LeadActivity`.
</domain>

<decisions>
## Implementation Decisions

### Human-Readable Branch Change Presentation
- **D-01:** Distinct Green Badge & Detailed Text:
  - In `getActionBadge`: render `{ label: "Branch Changed", color: "#059669", bg: "rgba(5, 150, 105, 0.1)" }`.
  - In `getActionDescription`: return `Changed branch from "${oldValue || 'Unassigned'}" to "${newValue || 'Unassigned'}"`.
  - In log filter: add `<option value="BRANCH_CHANGE">Branch Changes</option>`. — **Reversibility:** reversible.

### Invisibility Audit
- **D-02:** Superadmin Exclusion Verification:
  - Ensure `/api/admin/activity/logs` query filters out Superadmin usernames (`notIn: [superUsername, 'sudo']`).
  - Combined with Phase 7's early-exit guard in `logLeadActivity`, Superadmin activities are guaranteed to be 100% invisible. — **Reversibility:** irreversible privacy guarantee.
</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — `BRCH-06`
- `.planning/ROADMAP.md` — Phase 9 success criteria

### Target Modules
- `src/app/activity/page.tsx` — Superadmin audit log dashboard
- `src/app/api/admin/activity/logs/route.ts` — Superadmin activity query API
</canonical_refs>
