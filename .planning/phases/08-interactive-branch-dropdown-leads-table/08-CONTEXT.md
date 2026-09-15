# Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile) - Context

**Gathered:** 2026-09-15
**Status:** Ready for execution

<domain>
## Phase Boundary

Replaces static branch badges in both the desktop leads table and mobile cards with an interactive branch dropdown (`<select>`):
1. Dropdown options dynamically include all active branches created in the `/branches` management tab (retrieved from `/api/branches`), plus an "Unassigned" option.
2. The initial/default value reflects the branch auto-assigned from the customer's estimated location (`lead.branch`), or "Unassigned" if empty.
3. If a lead currently has an assigned consultant when a user changes the branch, an inline confirmation dialog warns the user and confirms clearing the consultant (`clearConsultant: true`).
4. Reassigning branch directly updates PostgreSQL via `PATCH /api/leads/[id]` with optimistic updates and error rollback.
5. Supported for all logged-in staff users across both desktop table and mobile card views.
</domain>

<decisions>
## Implementation Decisions

### Dynamic Branch Options
- **D-01:** Populate from `/api/branches`:
  - Ensure `fetchBranchesList` in `src/app/dashboard/page.tsx` parses `data.branchNames` / `data.branches` correctly into a clean `string[]`.
  - In `branches` useMemo, combine all database branches with any historical lead branches.
  - Dropdown options: `<option value="">Unassigned</option>` followed by all mapped branches sorted alphabetically. — **Reversibility:** reversible.

### Consultant Clearance Confirmation
- **D-02:** Confirmation Modal for Consultant Clearance:
  - If `lead.assignedConsultant` is present, selecting a different branch opens `branchConfirmModal` detailing the current consultant and target branch.
  - On confirm: updates branch with `clearConsultant: true`.
  - On cancel: reverts dropdown selection.
  - If no consultant was assigned, updates branch immediately without modal. — **Reversibility:** reversible.

### Desktop & Mobile Parity
- **D-03:** Consistent Behavior:
  - In desktop table: Branch column renders a styled `.branch-select` dropdown.
  - In mobile cards: Branch meta-item renders `.branch-select` with responsive full-width wrapping. — **Reversibility:** reversible.
</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — `BRCH-01`, `BRCH-02`, `BRCH-03`, `BRCH-04`
- `.planning/ROADMAP.md` — Phase 8 success criteria

### Target Modules
- `src/app/dashboard/page.tsx` — Main CRM dashboard leads table & mobile view
- `src/app/globals.css` — Styling for `.branch-select`
</canonical_refs>
