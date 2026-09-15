# Roadmap: SGA Tata CRM

## Overview

Transition SGA Tata CRM to an intelligent, automated location-based nearest-branch assignment engine, complemented by staff interactive branch overrides in the leads table with complete audit transparency.

- **Milestone v1.0 (Phases 1-6)**: Delivered Branches Management UI, embedded Tamil Nadu location dictionary with fuzzy matching, rate-limited geocoding fallback with DB caching, geodesic nearest-branch routing, and ingestion pipeline integration.
- **Milestone v1.1 (Phases 7-9)**: Delivers an interactive branch dropdown in the leads table (desktop and mobile) populated from the branches tab, defaulting to estimated location mapping, prompting for confirmation before clearing assigned consultants, and logging user branch changes for Superadmin review while keeping Superadmin actions strictly hidden.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (e.g. 2.1): Urgent insertions if needed

### Milestone v1.0: Tata Location-Based Auto Branch Assignment

- [x] **Phase 1: Branch Data Model & CRUD API** - Model branches with coordinates in Prisma and build REST endpoints.
- [x] **Phase 2: Branches Management UI** - Create dedicated `/branches` dashboard view and navigation link.
- [x] **Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching** - Embedded TN cities/towns/pincodes with typo-tolerant matcher.
- [x] **Phase 4: Geocoding Fallback Service & Rate-Limited Location Cache** - External geocoding integration with rate limiting and DB caching.
- [x] **Phase 5: Nearest-Branch Routing Engine** - Haversine distance calculations and automated lead branch routing.
- [x] **Phase 6: Lead Ingestion & Sync Pipeline Integration** - Adapt Google Sheets sync, Excel upload modal, and webhooks.

### Milestone v1.1: Interactive Lead Branch Selection & Override

- [x] **Phase 7: Backend Lead Branch Update & Activity Audit Pipeline** - Extend `PATCH /api/leads/[id]` for branch updates, consultant clearance, and audit logging with Superadmin invisibility.
- [x] **Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile)** - Build dynamic branch dropdowns in desktop table and mobile cards with consultant clearance confirmation prompt.
- [x] **Phase 9: Superadmin Activity Log Integration & Verification** - Formatted branch change audit log presentation in `/activity` and end-to-end pipeline verification.

---

## Phase Details

### Phase 7: Backend Lead Branch Update & Activity Audit Pipeline
**Goal**: Allow updating a lead's branch via `PATCH /api/leads/[id]`, support atomic consultant clearance, and log branch changes in `LeadActivity` while strictly hiding Superadmin activities.
**Depends on**: Phase 6
**Requirements**: [BRCH-05, BRCH-06]
**Success Criteria**:
  1. `PATCH /api/leads/[id]` accepts `branch` and updates the lead in PostgreSQL.
  2. `logLeadDiff` logs `BRANCH_CHANGE` action with old and new branch values when modified by standard users.
  3. Superadmin branch updates leave zero log records in `LeadActivity` (`isSuperAdminUser` check strictly upheld).
  4. Supports optional `clearConsultant: true` or explicit `assignedConsultant: null` when reassigning branch.
**Plans**: 2 plans

Plans:
- [x] 07-01: Update `src/lib/activity.ts` and `src/app/api/leads/[id]/route.ts` to support branch updates, consultant clearance, and `BRANCH_CHANGE` activity logging.
- [x] 07-02: Write automated verification script testing branch update, consultant clearance, activity creation, and Superadmin log suppression.

### Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile)
**Goal**: Replace static branch badges in the leads table and mobile cards with an interactive dropdown populated with all branches from the Branches tab, defaulting to the estimated mapped branch, and prompting for confirmation before clearing assigned consultants.
**Depends on**: Phase 7
**Requirements**: [BRCH-01, BRCH-02, BRCH-03, BRCH-04]
**Success Criteria**:
  1. Leads table renders an interactive branch `<select>` dropdown populated dynamically with all active branches from `/api/branches` plus "Unassigned".
  2. Default selected branch reflects the branch auto-assigned from the lead's estimated location (or "Unassigned" if empty/out-of-state).
  3. Any logged-in user can change the branch directly from the table.
  4. If the lead has an assigned consultant, a confirmation modal prompts the user before clearing the consultant assignment upon branch switch.
  5. Mobile card view features the identical interactive dropdown and confirmation prompt workflow.
  6. Optimistic UI updates with automatic rollback and toast notifications on API failure.
**Plans**: 2 plans

Plans:
- [x] 08-01: Build branch dropdown component with confirmation modal for consultant clearance in desktop leads table.
- [x] 08-02: Integrate branch dropdown into mobile card view and wire optimistic state updates with error handling.

### Phase 9: Superadmin Activity Log Integration & Verification
**Goal**: Present clean, human-readable branch change audit records in the Superadmin logs viewer (`/activity`) and perform complete end-to-end validation.
**Depends on**: Phase 8
**Requirements**: [BRCH-06]
**Success Criteria**:
  1. Superadmin viewing `/activity` sees clear `BRANCH_CHANGE` audit entries (e.g. "Branch changed from Coimbatore to Salem").
  2. Superadmin actions are completely absent from the activity viewer and database audit records.
  3. Full end-to-end browser and API verification of branch assignment override flow.
**Plans**: 1 plan

Plans:
- [x] 09-01: Update activity log UI formatting for `BRANCH_CHANGE` and run end-to-end verification.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Branch Data Model & CRUD API | 2/2 | Complete | 2026-09-11 |
| 2. Branches Management UI | 2/2 | Complete | 2026-09-11 |
| 3. Tamil Nadu Location Knowledge Base & Fuzzy Matching | 2/2 | Complete | 2026-09-11 |
| 4. Geocoding Fallback Service & Rate-Limited Location Cache | 2/2 | Complete | 2026-09-11 |
| 5. Nearest-Branch Routing Engine | 2/2 | Complete | 2026-09-12 |
| 6. Lead Ingestion & Sync Pipeline Integration | 2/2 | Complete | 2026-09-12 |
| 7. Backend Lead Branch Update & Activity Audit Pipeline | 2/2 | Complete | 2026-09-15 |
| 8. Interactive Branch Dropdown in Leads Table (Desktop & Mobile) | 2/2 | Complete | 2026-09-15 |
| 9. Superadmin Activity Log Integration & Verification | 1/1 | Complete | 2026-09-15 |

---
*Roadmap defined: 2026-09-11*
*Milestone v1.1 added: 2026-09-15*
