# Requirements: SGA Tata CRM

**Defined:** 2026-09-11
**Core Value:** Intelligent, error-resilient lead intake and automated nearest-branch assignment ensuring rapid customer follow-up without manual sorting.

## v1 Requirements

### Branches Management

- [x] **BRANCH-01**: Prisma schema defines `Branch` model with `name`, `code`, `address`, `city`, `latitude`, `longitude`, `radiusKm`, and `isActive` status.
- [x] **BRANCH-02**: Dedicated Branches Management view (`/branches`) in the dashboard navigation to view, create, edit, and toggle active status of branches.
- [x] **BRANCH-03**: Backend API endpoints (`/api/branches`, `/api/branches/[id]`) supporting full CRUD operations with role-based validation.

### Location Knowledge & Fuzzy Matching

- [x] **LOC-01**: Embedded Tamil Nadu geographical dictionary containing major cities, towns, taluks, and common pincodes with pre-calculated centroid coordinates.
- [x] **LOC-02**: Fast, typo-tolerant fuzzy string matching to map misspellings, colloquial names, and partial city strings to canonical locations without network calls.
- [ ] **LOC-03**: Persistent PostgreSQL location cache (`LocationCache` model) storing sanitized search terms, latitude, longitude, canonical name, and source.

### Geocoding Fallback & Resilience

- [ ] **GEO-01**: External geocoding service integration (Google Maps Geocoding API / Nominatim fallback) invoked only when local dictionary matching fails.
- [ ] **GEO-02**: Strict client-side rate limiting (queueing and throttling) on geocoding requests to prevent rate limit exhaustion and unexpected costs.
- [ ] **GEO-03**: Immediate caching of successfully resolved geocodes into `LocationCache` to ensure zero repeat API calls for previously resolved locations.

### Nearest Branch Routing Engine

- [ ] **ROUTE-01**: Geodesic distance engine using Haversine formula to compute distances in kilometers between lead coordinates and all operational branches.
- [ ] **ROUTE-02**: Automated branch resolver assigning incoming leads to the geographically nearest active branch.
- [ ] **ROUTE-03**: Audit log entry in `LeadActivity` recording the resolved location, distance to assigned branch, and matching method (dictionary, cache, or geocoder).

### Lead Ingestion & Sheet Sync Adaptation

- [ ] **INGEST-01**: Update Google Sheets column mapping and sync logic (`src/lib/sync.ts`) to remove branch column requirement and ingest location (city) and optional zipcode.
- [ ] **INGEST-02**: Update manual Excel/CSV external upload modal (`src/components/ExternalUploadModal.tsx`) to trigger auto-branch assignment for uploaded rows lacking branch data.
- [ ] **INGEST-03**: Inbound direct lead webhook (`/api/webhooks/lead`) automatically triggers location resolution and nearest branch assignment.

## v2 Requirements

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
| BRANCH-01 | Phase 1: Branch Data Model & API | Complete |
| BRANCH-02 | Phase 2: Branches Management UI | Complete |
| BRANCH-03 | Phase 1: Branch Data Model & API | Complete |
| LOC-01 | Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching | Complete |
| LOC-02 | Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching | Complete |
| LOC-03 | Phase 4: Geocoding Fallback Service & Rate-Limited Cache | Pending |
| GEO-01 | Phase 4: Geocoding Fallback Service & Rate-Limited Cache | Pending |
| GEO-02 | Phase 4: Geocoding Fallback Service & Rate-Limited Cache | Pending |
| GEO-03 | Phase 4: Geocoding Fallback Service & Rate-Limited Cache | Pending |
| ROUTE-01 | Phase 5: Nearest-Branch Routing Engine | Pending |
| ROUTE-02 | Phase 5: Nearest-Branch Routing Engine | Pending |
| ROUTE-03 | Phase 5: Nearest-Branch Routing Engine | Pending |
| INGEST-01 | Phase 6: Lead Ingestion & Sync Pipeline Integration | Pending |
| INGEST-02 | Phase 6: Lead Ingestion & Sync Pipeline Integration | Pending |
| INGEST-03 | Phase 6: Lead Ingestion & Sync Pipeline Integration | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-11*
*Last updated: 2026-09-11 after milestone v1.0 definition*
