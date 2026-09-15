# Roadmap: SGA Tata CRM

## Overview

Transition SGA Tata CRM to an intelligent, automated location-based nearest-branch assignment engine, complemented by staff interactive branch overrides, Tamil Nadu geocoding bounding optimization, and 3-category lead management views (`Priority`, `Valid`, `Unassigned`).

- **Milestone v1.0 (Phases 1-6)**: Delivered Branches Management UI, embedded Tamil Nadu location dictionary with fuzzy matching, rate-limited geocoding fallback with DB caching, geodesic nearest-branch routing, and ingestion pipeline integration.
- **Milestone v1.1 (Phases 7-9)**: Delivered interactive branch dropdown in leads table (desktop and mobile) populated from the branches tab, defaulting to estimated location mapping, consultant clearance safeguard, and Superadmin activity audit logging.
- **Milestone v1.2 (Phases 10-12)**: Delivers Tamil Nadu geocoding bounding optimization (`bounds` / `viewbox`), spatial boundary validation, and a 3-category lead switcher (`Priority`, `Valid`, `Unassigned`) with live badge counts, quick switching, and full mobile support.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (e.g. 10.1): Urgent insertions if needed

### Milestone v1.0: Tata Location-Based Auto Branch Assignment
*(Completed 2026-09-12 — archived to `.planning/milestones/v1.0-phases/`)*
- [x] **Phase 1: Branch Data Model & CRUD API**
- [x] **Phase 2: Branches Management UI**
- [x] **Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching**
- [x] **Phase 4: Geocoding Fallback Service & Rate-Limited Location Cache**
- [x] **Phase 5: Nearest-Branch Routing Engine**
- [x] **Phase 6: Lead Ingestion & Sync Pipeline Integration**

### Milestone v1.1: Interactive Lead Branch Selection & Override
*(Completed 2026-09-15 — archived to `.planning/milestones/v1.1-phases/`)*
- [x] **Phase 7: Backend Lead Branch Update & Activity Audit Pipeline**
- [x] **Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile)**
- [x] **Phase 9: Superadmin Activity Log Integration & Verification**

### Milestone v1.2: Tamil Nadu Geocoding Optimization & Multi-Category Lead Views
- [x] **Phase 10: Tamil Nadu Geocoding Bounding & Spatial Verification** - Restrict Nominatim and Google Geocoding queries to Tamil Nadu bounding rect and enforce spatial validation in the resolver.
- [x] **Phase 11: Backend Lead Categorization Pipeline & Category Query API** - Implement 3-category taxonomy (`priority`, `valid`, `unassigned`) and backend `/api/leads` filtering with live category counts.
- [ ] **Phase 12: Interactive Leads Table Category Switcher & Mobile Views** - Build responsive category switcher tabs in desktop table and mobile cards with live counter badges and seamless switching.

---

## Phase Details

### Phase 10: Tamil Nadu Geocoding Bounding & Spatial Verification
**Goal**: Restrict external geocoding queries strictly to Tamil Nadu using bounding rectangle parameters (approx. 8.08° N, 76.23° E to 13.55° N, 80.35° E) for Nominatim (`viewbox`, `bounded=1`) and Google Maps (`bounds`, `components`), and add spatial coordinate verification in the tiered resolver to ensure out-of-state leads remain unassigned.
**Depends on**: Phase 9
**Requirements**: [GEO-05, GEO-06]
**Success Criteria**:
  1. `queryNominatim` appends `viewbox=76.23,13.55,80.35,8.08` to focus search on Tamil Nadu.
  2. `queryGoogleGeocode` passes `bounds=8.08,76.23|13.55,80.35` and `components=country:IN|administrative_area:Tamil Nadu`.
  3. Resolver evaluates coordinates against the Tamil Nadu bounding rectangle and marks coordinates outside as `isTamilNadu: false`.
  4. Routing engine rejects coordinates outside Tamil Nadu bounding box as `out_of_state` and keeps branch unassigned.
**Plans**: 2 plans

Plans:
- [x] 10-01: Update `src/lib/location/geocoder.ts` with bounding box constants, query params for Nominatim and Google Geocoder, and spatial boundary validator.
- [x] 10-02: Write automated test suite verifying in-state vs out-of-state location resolutions and cache behavior.

### Phase 11: Backend Lead Categorization Pipeline & Category Query API
**Goal**: Implement the 3-category lead taxonomy (`priority`, `valid`, `unassigned`) in the backend with full support in `GET /api/leads` and stats aggregation for live tab counters.
**Depends on**: Phase 10
**Requirements**: [LEAD-CAT-01, LEAD-CAT-02]
**Success Criteria**:
  1. `GET /api/leads?category=priority` returns leads located inside Tamil Nadu with follow-up scheduled for today or overdue (`followUpDate1` or `followUpDate2` <= today 23:59:59 IST).
  2. `GET /api/leads?category=valid` returns all valid leads inside Tamil Nadu (assigned to a dealership branch or valid TN location).
  3. `GET /api/leads?category=unassigned` returns leads outside Tamil Nadu (out-of-state) or unresolved/unassigned.
  4. Category counts (`priority`, `valid`, `unassigned`, `all`) returned in `/api/leads` stats for live badge rendering without extra round-trips.
  5. Category filtering composes cleanly with text search, date filters, consultant filters, and pagination.
**Plans**: 2 plans

Plans:
- [x] 11-01: Update `src/app/api/leads/route.ts` to implement Prisma `where` clause builder for `category` and compute category stats.
- [x] 11-02: Automated verification script testing queries for all 3 categories, date boundary edge cases, and count totals.

### Phase 12: Interactive Leads Table Category Switcher & Mobile Views
**Goal**: Build an interactive, polished category switcher bar above the leads table in desktop view and mobile card view, allowing staff to seamlessly switch between Priority, Valid, and Unassigned leads with live badge counts.
**Depends on**: Phase 11
**Requirements**: [LEAD-CAT-03, LEAD-CAT-04, LEAD-CAT-05]
**Success Criteria**:
  1. Dashboard leads table renders a category tab bar (`Priority (Follow-up Today)`, `Valid (Tamil Nadu)`, `Unassigned (Out of State)`, `All Leads`).
  2. Each tab displays a live counter badge reflecting the count of leads in that category.
  3. Clicking a tab filters the leads list instantly, updates pagination to page 1, and synchronizes URL query params.
  4. Mobile card view includes the category switcher with full touch responsiveness.
  5. Category preference persists across reloads via localStorage / URL params.
**Plans**: 2 plans

Plans:
- [ ] 12-01: Create category tab switcher component in `src/app/dashboard/page.tsx` and integrate live badge counters and client cache keys.
- [ ] 12-02: Adapt mobile card view, test switching across all 3 categories in browser, and perform end-to-end verification.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Tamil Nadu Geocoding Bounding & Spatial Verification | 2/2 | Complete | 2026-09-15 |
| 11. Backend Lead Categorization Pipeline & Category Query API | 2/2 | Complete | 2026-09-15 |
| 12. Interactive Leads Table Category Switcher & Mobile Views | 0/2 | Ready | — |

---
*Roadmap defined: 2026-09-15*
*Milestone: v1.2*
