# SGA Tata CRM

## What This Is

Lead management CRM dashboard for SGA Tata Motors dealership network. Tracks, manages, and routes customer leads arriving from Google Sheets, ad campaigns, and manual uploads to sales consultants across authorized dealership branches throughout Tamil Nadu.

## Core Value

Intelligent, error-resilient lead intake and automated nearest-branch assignment ensuring rapid customer follow-up without manual sorting, paired with responsive staff branch assignment, focused Tamil Nadu geographic routing, and multi-category lead views with complete audit transparency.

## Requirements

### Validated

- ✓ Multi-role authentication (ADMIN, USER) with JWT session cookies and secure scrypt password hashing — `src/lib/auth.ts`, `src/lib/passwords.ts`
- ✓ Dealership branch and consultant allocation with calendar follow-up scheduling — `src/app/dashboard/page.tsx`, `src/app/calendar/page.tsx`
- ✓ Web Push notifications (VAPID) and background worker alerts for new leads — `src/lib/notifications.ts`, `src/instrumentation.ts`
- ✓ Full persistent lead activity audit logging — `src/lib/activity.ts`
- ✓ PDF report export and Excel sheet data import/export — `src/components/ExternalUploadModal.tsx`, `jspdf`, `xlsx`
- ✓ Bi-directional Google Sheets synchronization engine with row hashing — `src/lib/sync.ts`, `src/lib/google.ts`
- ✓ **BRANCH-01 / 02 / 03**: Branches data model, CRUD API, and dedicated `/branches` view — `src/app/branches/page.tsx`, `src/app/api/branches/route.ts` (v1.0)
- ✓ **LOC-01 / 02**: Built-in Tamil Nadu location dictionary with typo-tolerant fuzzy string matching — `src/lib/location/matcher.ts`, `src/lib/location/tn-locations.ts` (v1.0)
- ✓ **LOC-03 / GEO-01 / 02 / 03**: Geocoding fallback with persistent DB location cache (`LocationCache`) and queue throttling — `src/lib/location/geocoder.ts` (v1.0)
- ✓ **ROUTE-01 / 02 / 03**: Nearest-branch routing engine via Haversine calculation with out-of-state fence and audit trail — `src/lib/location/routing.ts` (v1.0)
- ✓ **INGEST-01 / 02 / 03**: Lead ingestion pipeline integration across Google Sheets sync, Excel upload modal, and webhooks — `src/lib/sync.ts`, `src/components/ExternalUploadModal.tsx`, `src/app/api/webhooks/lead/route.ts` (v1.0)
- ✓ **BRCH-01 / 02 / 03 / 04 / 05 / 06**: Interactive branch dropdown in leads table & mobile cards, estimated location defaults, consultant clearance prompt, lead patch endpoint, and Superadmin audit logging with strict invisibility — `src/app/dashboard/page.tsx`, `src/app/api/leads/[id]/route.ts`, `src/app/activity/page.tsx`, `src/lib/activity.ts` (v1.1)
- ✓ **GEO-05 / 06**: Tamil Nadu geocoding bounding box restriction (`[8.08, 13.55]` lat, `[76.23, 80.35]` lon) for Nominatim and Google Maps, and spatial coordinate verification in tiered resolver — `src/lib/location/geocoder.ts` (v1.2)
- ✓ **LEAD-CAT-01 / 02 / 03 / 04 / 05**: 3-category lead taxonomy (`Priority`, `Valid`, `Unassigned`) with IST end-of-day boundary, `/api/leads?category=...` query engine with parallel stats calculation, and interactive segmented tab switcher with live badges in desktop and mobile — `src/app/api/leads/route.ts`, `src/app/dashboard/page.tsx`, `src/app/globals.css` (v1.2)

### Out of Scope

- Multi-state branch operations — SGA Tata dealership operations are strictly scoped to Tamil Nadu.
- Real-time GPS driver tracking — CRM focus is on lead intake and branch assignment, not transit tracking.
- Direct customer SMS gateway — Notifications currently handled via Web Push and consultant CRM dashboard.
- Live traffic distance matrix routing — Great-circle (Haversine) distance is computationally efficient, deterministic, and sufficient for branch catchment zones.

## Context

With Milestones v1.0, v1.1, and v1.2 successfully completed, SGA Tata CRM has full automated nearest-branch location routing, interactive branch overrides with audit tracking, focused Tamil Nadu geographic query bounding, and responsive multi-category views (`Priority`, `Valid`, `Unassigned`, `All Leads`) across desktop and mobile.

## Constraints

- **Geographic Focus**: Dealership catchment is strictly within Tamil Nadu (and Puducherry enclave). Bounding rectangle coordinates: Lat [8.08, 13.55], Lon [76.23, 80.35].
- **Priority Definition**: Priority leads must be both inside Tamil Nadu AND have an actionable follow-up scheduled for today or overdue (`followUpDate1` or `followUpDate2` <= today's end-of-day in IST).
- **Zero Disruption to Existing Filters**: Category tabs compose cleanly with search, date ranges, uploader filters, consultant filters, sorting, and pagination.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Geocoding Bounding Box: [8.08, 76.23] to [13.55, 80.35] | Restricts external geocoding candidate matches strictly to Tamil Nadu territory | ✓ Validated |
| Priority Category includes Today & Overdue follow-ups | Ensures consultants never miss overdue follow-ups alongside today's scheduled follow-ups | ✓ Validated |
| Category Tabs in Leads Table Header | Enables one-click switching between Priority, Valid, and Unassigned leads without navigating away | ✓ Validated |
| Superadmin logs strictly hidden | Strict business rule: Superadmin actions must leave zero trace in audit logs | ✓ Validated |

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
*Last updated: 2026-09-15 after milestone v1.2 initialization*
