# Requirements: SGA Tata CRM

**Defined:** 2026-09-15
**Milestone:** v1.1
**Core Value:** Intelligent, error-resilient lead intake and automated nearest-branch assignment ensuring rapid customer follow-up without manual sorting, paired with responsive staff branch assignment and complete audit transparency.

## v1.1 Requirements

### Interactive Branch Selection & Override

- [ ] **BRCH-01**: Interactive branch dropdown in the leads table populated with all active branches registered in the `/branches` management tab.
- [ ] **BRCH-02**: Default dropdown value set to the branch mapped from the estimated location of user (or "Unassigned" if unmapped/out-of-state).
- [ ] **BRCH-03**: Any logged-in user can change the branch for a lead in both the desktop table view and mobile card view.
- [ ] **BRCH-04**: Interactive confirmation prompt before clearing an assigned consultant when reassigning branch.
- [x] **BRCH-05**: Persistent database update via `PATCH /api/leads/[id]` supporting `branch` field (and optional consultant reset) with optimistic UI updates and error rollback.
- [ ] **BRCH-06**: Full audit logging of branch changes into `LeadActivity` (`BRANCH_CHANGE` action) visible to Superadmin in `/activity` logs viewer, while strictly hiding Superadmin activities.

## Completed v1.0 Requirements

### Branches Management
- [x] **BRANCH-01**: Prisma schema defines `Branch` model with `name`, `code`, `address`, `city`, `latitude`, `longitude`, `radiusKm`, and `isActive` status.
- [x] **BRANCH-02**: Dedicated Branches Management view (`/branches`) in the dashboard navigation to view, create, edit, and toggle active status of branches.
- [x] **BRANCH-03**: Backend API endpoints (`/api/branches`, `/api/branches/[id]`) supporting full CRUD operations with role-based validation.

### Location Knowledge & Fuzzy Matching
- [x] **LOC-01**: Embedded Tamil Nadu geographical dictionary containing major cities, towns, taluks, and common pincodes with pre-calculated centroid coordinates.
- [x] **LOC-02**: Fast, typo-tolerant fuzzy string matching to map misspellings, colloquial names, and partial city strings to canonical locations without network calls.
- [x] **LOC-03**: Persistent PostgreSQL location cache (`LocationCache` model) storing sanitized search terms, latitude, longitude, canonical name, and source.

### Geocoding Fallback & Resilience
- [x] **GEO-01**: External geocoding service integration (Google Maps Geocoding API / Nominatim fallback) invoked only when local dictionary matching fails.
- [x] **GEO-02**: Strict client-side rate limiting (queueing and throttling) on geocoding requests to prevent rate limit exhaustion and unexpected costs.
- [x] **GEO-03**: Immediate caching of successfully resolved geocodes into `LocationCache` to ensure zero repeat API calls for previously resolved locations.

### Nearest Branch Routing Engine
- [x] **ROUTE-01**: Geodesic distance engine using Haversine formula to compute distances in kilometers between lead coordinates and all operational branches.
- [x] **ROUTE-02**: Automated branch resolver assigning incoming leads to the geographically nearest active branch.
- [x] **ROUTE-03**: Audit log entry in `LeadActivity` recording the resolved location, distance to assigned branch, and matching method (dictionary, cache, or geocoder).

### Lead Ingestion & Sheet Sync Adaptation
- [x] **INGEST-01**: Update Google Sheets column mapping and sync logic (`src/lib/sync.ts`) to remove branch column requirement and ingest location (city) and optional zipcode.
- [x] **INGEST-02**: Update manual Excel/CSV external upload modal (`src/components/ExternalUploadModal.tsx`) to trigger auto-branch assignment for uploaded rows lacking branch data.
- [x] **INGEST-03**: Inbound direct lead webhook (`/api/webhooks/lead`) automatically triggers location resolution and nearest branch assignment.

## Future Requirements (Backlog)

### Advanced Logistics & Redistribution
- **ROUTE-04**: Dynamic capacity balancing (round-robin or lead cap per branch when a primary branch is overloaded).
- **GEO-04**: Map visualization in dashboard showing lead geographical clustering and branch catchment zones.
- **NOTF-05**: Immediate consultant push notification when a lead is assigned via auto-routing.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time GPS transit tracking | Out of scope for sales lead CRM intake |
| Driving distance matrix API | Haversine distance is sufficient and avoids heavy per-call API billing |
| Multi-state dictionary | Tata dealership operations are scoped specifically to Tamil Nadu |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRCH-05 | Phase 7: Backend Lead Branch Update & Activity Audit Pipeline | Complete |
| BRCH-06 | Phase 7: Backend Lead Branch Update & Activity Audit Pipeline | Complete |
| BRCH-01 | Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile) | Pending |
| BRCH-02 | Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile) | Pending |
| BRCH-03 | Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile) | Pending |
| BRCH-04 | Phase 8: Interactive Branch Dropdown in Leads Table (Desktop & Mobile) | Pending |
| BRCH-06 | Phase 9: Superadmin Activity Log Integration & Verification | Pending |

**Coverage:**
- v1.1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-15*
*Last updated: 2026-09-15 after milestone v1.1 definition*
