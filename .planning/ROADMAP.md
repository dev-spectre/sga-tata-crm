# Roadmap: SGA Tata CRM

## Overview

Transition SGA Tata CRM from relying on an explicit branch column in incoming sheets to an intelligent, automated location-based nearest-branch assignment engine. This roadmap delivers a full Branches Management interface, an embedded Tamil Nadu location dictionary with fuzzy matching, rate-limited geocoding fallback with persistent caching, geodesic nearest-branch routing, and pipeline integration across Google Sheets sync, manual uploads, and webhooks.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (e.g. 2.1): Urgent insertions if needed

- [ ] **Phase 1: Branch Data Model & CRUD API** - Model branches with coordinates in Prisma and build REST endpoints.
- [ ] **Phase 2: Branches Management UI** - Create dedicated `/branches` dashboard view and navigation link.
- [ ] **Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching** - Embedded TN cities/towns/pincodes with typo-tolerant matcher.
- [ ] **Phase 4: Geocoding Fallback Service & Rate-Limited Location Cache** - External geocoding integration with rate limiting and DB caching.
- [ ] **Phase 5: Nearest-Branch Routing Engine** - Haversine distance calculations and automated lead branch routing.
- [ ] **Phase 6: Lead Ingestion & Sync Pipeline Integration** - Adapt Google Sheets sync, Excel upload modal, and webhooks.

## Phase Details

### Phase 1: Branch Data Model & CRUD API
**Goal**: Establish the foundational database schema and backend API for dealership branches with geolocation support.
**Depends on**: Nothing (first phase)
**Requirements**: [BRANCH-01, BRANCH-03]
**Success Criteria**:
  1. `Branch` model exists in `prisma/schema.prisma` with `name`, `code`, `address`, `city`, `latitude`, `longitude`, `radiusKm`, and `isActive`.
  2. Database migration runs cleanly without data loss.
  3. `GET /api/branches`, `POST /api/branches`, `PUT /api/branches/[id]`, and `DELETE /api/branches/[id]` allow complete branch management.
**Plans**: 2 plans

Plans:
- [ ] 01-01: Update Prisma schema with `Branch` model and execute migration.
- [ ] 01-02: Implement `/api/branches` and `/api/branches/[id]` route handlers with RBAC validation.

### Phase 2: Branches Management UI
**Goal**: Provide dealership administrators with a dedicated UI to manage branches, input coordinates, and toggle active status.
**Depends on**: Phase 1
**Requirements**: [BRANCH-02]
**Success Criteria**:
  1. Dealership staff can navigate to `/branches` via the sidebar navigation.
  2. Users can create, update, and search branches with visual status badges (active/inactive).
  3. Branch modal supports address and latitude/longitude input with validation.
**Plans**: 2 plans

Plans:
- [ ] 02-01: Build `/branches` page with branch table, search filter, and status toggle.
- [ ] 02-02: Build branch create/edit modal and integrate with sidebar navigation.

### Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching
**Goal**: Deliver an offline-first dictionary of Tamil Nadu locations capable of resolving cities, towns, and pincodes with typo tolerance.
**Depends on**: Phase 2
**Requirements**: [LOC-01, LOC-02]
**Success Criteria**:
  1. Embedded dataset covers all Tamil Nadu districts, major towns, taluks, and pincodes with centroid coordinates.
  2. Fuzzy matching algorithm correctly resolves common misspellings and abbreviations (e.g. "Cbe" -> Coimbatore, "Madurei" -> Madurai).
  3. Resolves locations in <5ms without external API dependencies.
**Plans**: 2 plans

Plans:
- [ ] 03-01: Curate and construct the structured Tamil Nadu geographical dataset with coordinates.
- [ ] 03-02: Implement the fuzzy matching library and unit verification scripts.

### Phase 4: Geocoding Fallback Service & Rate-Limited Location Cache
**Goal**: Provide resilient fallback to external geocoding when an input is not in the local dictionary, with strict rate limiting and DB caching.
**Depends on**: Phase 3
**Requirements**: [LOC-03, GEO-01, GEO-02, GEO-03]
**Success Criteria**:
  1. `LocationCache` table in PostgreSQL caches query string, latitude, longitude, and source.
  2. External geocoding service requests are throttled and queued to prevent quota exhaustion.
  3. Cached locations return instantly without hitting the external geocoding API.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Create `LocationCache` Prisma model and migration.
- [ ] 04-02: Implement rate-limited geocoding client with fallback cascade (Cache -> Geocoder -> Persist).

### Phase 5: Nearest-Branch Routing Engine
**Goal**: Automatically compute geodesic distances and assign incoming leads to the closest operational branch.
**Depends on**: Phase 4
**Requirements**: [ROUTE-01, ROUTE-02, ROUTE-03]
**Success Criteria**:
  1. Haversine formula correctly calculates distance in km between lead coordinates and branch coordinates.
  2. Resolves closest active branch and sets `lead.branch`.
  3. Records routing decision and distance in `LeadActivity` audit log.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Implement Haversine math module and branch distance ranking logic.
- [ ] 05-02: Implement `assignNearestBranch(lead)` service with audit trail logging.

### Phase 6: Lead Ingestion & Sync Pipeline Integration
**Goal**: Connect the routing engine into the live sync and import workflows, removing hardcoded branch dependencies.
**Depends on**: Phase 5
**Requirements**: [INGEST-01, INGEST-02, INGEST-03]
**Success Criteria**:
  1. Google Sheets sync (`src/lib/sync.ts`) successfully ingests Tata sheets without a branch column, mapping city/zipcode to branch.
  2. External Excel upload modal allows importing leads without a branch column and automatically assigns nearest branch.
  3. Webhook `/api/webhooks/lead` automatically routes leads to the closest branch.
**Plans**: 2 plans

Plans:
- [ ] 06-01: Update Google Sheets sync engine and column mapping logic.
- [ ] 06-02: Update external upload modal and lead webhook ingestion handlers.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Branch Data Model & CRUD API | 0/2 | Not started | - |
| 2. Branches Management UI | 0/2 | Not started | - |
| 3. Tamil Nadu Location Knowledge Base & Fuzzy Matching | 0/2 | Not started | - |
| 4. Geocoding Fallback Service & Rate-Limited Location Cache | 0/2 | Not started | - |
| 5. Nearest-Branch Routing Engine | 0/2 | Not started | - |
| 6. Lead Ingestion & Sync Pipeline Integration | 0/2 | Not started | - |
