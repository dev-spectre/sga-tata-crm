# Phase 6: Lead Ingestion & Sync Pipeline Integration - Validation Plan

**Date:** 2026-09-12

## Verification Strategy

### Automated Verification
1. **Google Sheets Sync Simulation (`test/ingestion.test.mjs`)**:
   - Verify lead creation from raw row data lacking a branch column:
     - Row with "Coimbatore" assigns to nearest Coimbatore branch.
     - Row with "Madurai" assigns to nearest Madurai branch.
     - Row with "Bangalore" leaves branch unassigned.
   - Verify existing lead branch protection:
     - Sheet row with empty branch does not overwrite an existing assigned branch.

2. **Webhook Endpoint Simulation**:
   - Post lead with `city: "Peelamedu, Coimbatore"` and empty branch:
     - Lead created with `branch: "Tata Coimbatore Central"` (or configured active branch).
     - Audit entry created in `LeadActivity`.

3. **External Upload Auto-Assignment**:
   - Verify that `src/app/api/sheets/external/route.ts` resolves branches when no branch column is mapped.

### Acceptance Criteria
- `npx tsc --noEmit` returns 0.
- `node --env-file=.env --test test/ingestion.test.mjs` exits with 0.
