# SGA Tata CRM

## What This Is

Lead management CRM dashboard for SGA Tata Motors dealership network. Tracks, manages, and routes customer leads arriving from Google Sheets, ad campaigns, and manual uploads to sales consultants across authorized dealership branches.

## Core Value

Intelligent, error-resilient lead intake and automated nearest-branch assignment ensuring rapid customer follow-up without manual sorting.

## Requirements

### Validated

- ✓ Multi-role authentication (ADMIN, USER) with JWT session cookies and secure scrypt password hashing — `src/lib/auth.ts`, `src/lib/passwords.ts`
- ✓ Dealership branch and consultant allocation with calendar follow-up scheduling — `src/app/dashboard/page.tsx`, `src/app/calendar/page.tsx`
- ✓ Web Push notifications (VAPID) and background worker alerts for new leads — `src/lib/notifications.ts`, `src/instrumentation.ts`
- ✓ Full persistent lead activity audit logging — `src/lib/activity.ts`
- ✓ PDF report export and Excel sheet data import/export — `src/components/ExternalUploadModal.tsx`, `jspdf`, `xlsx`
- ✓ Bi-directional Google Sheets synchronization engine with row hashing — `src/lib/sync.ts`, `src/lib/google.ts`

### Active

- [ ] **LOC-01**: Ingest Tata lead sheets containing location (city) and optional zipcode without requiring a raw branch column.
- [ ] **LOC-02**: Dedicated Branches Management view (`/branches`) to configure dealership branches with geographic coordinates (latitude, longitude) and operational addresses.
- [ ] **LOC-03**: Built-in Tamil Nadu city, town, and locality dictionary with typo-tolerant fuzzy string matching.
- [ ] **LOC-04**: Geocoding API fallback service with strict rate limiting and persistent database location caching for unresolved locations or zipcodes.
- [ ] **LOC-05**: Automated nearest-branch assignment engine calculating geodesic distance to route incoming leads directly to the closest branch.

### Out of Scope

- Real-time GPS driver tracking — CRM focus is on lead intake and branch assignment, not transit tracking.
- Direct customer SMS gateway — Notifications currently handled via Web Push and consultant CRM dashboard.
- Live traffic distance matrix routing — Great-circle (Haversine) distance is computationally efficient, deterministic, and sufficient for branch catchment zones.

## Context

The system was originally forked from a Skoda dealership CRM where the external Google Sheet provided an explicit branch column. Tata Motors lead sheets provide only customer location (city) and occasionally zipcode. Dealership branches are spread across Tamil Nadu (e.g., Coimbatore, Chennai, Madurai, Salem, Tirupur, etc.). Leads must automatically be assigned to the geographically nearest branch upon sync or upload.

## Constraints

- **API Rate Limits**: Geocoding API calls must be tightly rate-limited and cached in PostgreSQL to prevent quota exhaustion and latency spikes.
- **Offline First Matching**: All known Tamil Nadu cities and towns must be matched locally via the dictionary and fuzzy matcher before making any external API calls.
- **Database Schema**: Prisma migrations must maintain backward compatibility with existing leads while adding coordinates, resolved locations, and branch geolocation fields.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fuzzy local dictionary before Geocoding API | Reduces API cost to near-zero and eliminates network latency for 95%+ of Tamil Nadu leads | — Pending |
| Haversine geodesic calculation for branch mapping | Extremely fast in-memory math, avoids external distance matrix API quotas | — Pending |
| Persistent DB location cache (`LocationCache` model) | Geocoded results are permanently stored so identical cities/zipcodes are never looked up twice | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-11 after milestone v1.0 initialization*
