# Requirements: SGA Tata CRM

**Defined:** 2026-09-15
**Milestone:** v1.2
**Core Value:** Intelligent, error-resilient lead intake and automated nearest-branch assignment ensuring rapid customer follow-up without manual sorting, paired with responsive staff branch assignment, focused Tamil Nadu geographic routing, and multi-category lead views with complete audit transparency.

## v1.2 Requirements

### Tamil Nadu Geocoding Bounding & Spatial Verification

- [x] **GEO-05**: Optimize external geocoding API queries to focus exclusively on Tamil Nadu by applying bounding box coordinates (approx. 8.08° N, 76.23° E to 13.55° N, 80.35° E) in Nominatim (`viewbox=76.23,13.55,80.35,8.08`) and Google Geocoding API (`bounds=8.08,76.23|13.55,80.35` and `components=country:IN|administrative_area:Tamil Nadu`).
- [x] **GEO-06**: Strict geographic bounding and spatial verification in the tiered resolver to ensure coordinates outside the Tamil Nadu bounding rectangle are marked out-of-state and kept unassigned.

### Multi-Category Lead Taxonomy & Backend Filtering

- [x] **LEAD-CAT-01**: Implement 3 distinct lead categorization rules:
  1. **Priority**: Inside Tamil Nadu (valid mapped branch/location) AND scheduled for follow-up today or overdue (`followUpDate1` or `followUpDate2` <= today 23:59:59).
  2. **Valid**: All valid leads inside Tamil Nadu (assigned to a branch or with valid TN location).
  3. **Unassigned**: Leads outside Tamil Nadu (out-of-state) or unresolved/unassigned.
- [x] **LEAD-CAT-02**: Backend `/api/leads` query support for `category` filter (`priority`, `valid`, `unassigned`, `all`) with accurate total counts, pagination, search composability, and stats payload.

### Interactive UI Category Switcher & Mobile Views

- [x] **LEAD-CAT-03**: Segmented / tabbed category switcher bar above the leads table in the dashboard with one-click switching between `Priority`, `Valid (TN)`, `Unassigned (Out of State)`, and `All Leads`.
- [x] **LEAD-CAT-04**: Category badge counter indicators displaying live count of leads in each category (e.g. badge with number of Priority leads requiring attention today).
- [x] **LEAD-CAT-05**: Full URL query parameter synchronization (`?category=...`), localStorage persistence, and mobile card view compatibility.

## Completed v1.1 Requirements

### Interactive Branch Selection & Override
- [x] **BRCH-01**: Interactive branch dropdown in the leads table populated with all active branches registered in the `/branches` management tab.
- [x] **BRCH-02**: Default dropdown value set to the branch mapped from the estimated location of user (or "Unassigned" if unmapped/out-of-state).
- [x] **BRCH-03**: Any logged-in user can change the branch for a lead in both the desktop table view and mobile card view.
- [x] **BRCH-04**: Interactive confirmation prompt before clearing an assigned consultant when reassigning branch.
- [x] **BRCH-05**: Persistent database update via `PATCH /api/leads/[id]` supporting `branch` field (and optional consultant reset) with optimistic UI updates and error rollback.
- [x] **BRCH-06**: Full audit logging of branch changes into `LeadActivity` (`BRANCH_CHANGE` action) visible to Superadmin in `/activity` logs viewer, while strictly hiding Superadmin activities.

## Completed v1.0 Requirements

### Branches Management & Location Routing
- [x] **BRANCH-01 / 02 / 03**: Prisma schema, `/branches` management UI, and CRUD API.
- [x] **LOC-01 / 02 / 03**: Embedded TN location knowledge base, fuzzy matching, and persistent DB cache.
- [x] **GEO-01 / 02 / 03**: External geocoder fallback, rate limiting, and caching.
- [x] **ROUTE-01 / 02 / 03**: Nearest-branch routing engine via Haversine calculation with audit trail.
- [x] **INGEST-01 / 02 / 03**: Lead ingestion pipeline integration across Google Sheets sync, Excel upload, and webhooks.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-state branches | SGA Tata operations are strictly within Tamil Nadu |
| Real-time GPS transit tracking | Out of scope for sales lead CRM intake |
| Driving distance matrix API | Haversine distance is sufficient and avoids heavy per-call API billing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEO-05 | Phase 10: Tamil Nadu Geocoding Bounding & Spatial Verification | Complete |
| GEO-06 | Phase 10: Tamil Nadu Geocoding Bounding & Spatial Verification | Complete |
| LEAD-CAT-01 | Phase 11: Backend Lead Categorization Pipeline & Category Query API | Complete |
| LEAD-CAT-02 | Phase 11: Backend Lead Categorization Pipeline & Category Query API | Complete |
| LEAD-CAT-03 | Phase 12: Interactive Leads Table Category Switcher & Mobile Views | Complete |
| LEAD-CAT-04 | Phase 12: Interactive Leads Table Category Switcher & Mobile Views | Complete |
| LEAD-CAT-05 | Phase 12: Interactive Leads Table Category Switcher & Mobile Views | Complete |

**Coverage:**
- v1.2 requirements: 5 total (grouped into 3 phases: Phases 10, 11, 12)
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-15*
*Milestone: v1.2*
