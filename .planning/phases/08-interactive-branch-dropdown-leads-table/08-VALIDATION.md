# Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile) - Validation

**Created:** 2026-09-15
**Phase:** 08-interactive-branch-dropdown-leads-table

## Acceptance Criteria

1. **Branch Dropdown in Desktop Table**:
   - Branch column in leads table renders a `<select>` dropdown.
   - Populated with all active branches from `/branches` tab plus "Unassigned".
   - Default value is `lead.branch` (mapped from estimated location).

2. **Branch Dropdown in Mobile Cards**:
   - Mobile card view renders `<select>` for branch with responsive layout.

3. **Consultant Clearance Confirmation**:
   - If a lead has an assigned consultant, selecting a different branch prompts the user with a confirmation modal before clearing consultant.
   - Confirming clears consultant and updates branch via `PATCH /api/leads/[id]`.
   - Cancelling reverts dropdown without saving.
   - If no consultant was assigned, updates branch immediately without prompt.

4. **Optimistic Updates & Resilience**:
   - Table immediately reflects the updated branch.
   - Reverts state and shows toast error on network failure.
   - Typechecks cleanly (`npx tsc --noEmit` returns 0 errors).
