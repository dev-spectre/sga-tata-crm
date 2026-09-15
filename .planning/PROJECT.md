# SGA Tata CRM

## What This Is

Lead management CRM dashboard for SGA Tata Motors dealership network. Tracks, manages, and routes customer leads arriving from Google Sheets, ad campaigns, and manual uploads to sales consultants across authorized dealership branches.

## Core Value

Intelligent, error-resilient lead intake and automated nearest-branch assignment ensuring rapid customer follow-up without manual sorting, paired with responsive staff branch assignment and complete audit transparency.

## Requirements

### Validated

- ✓ Multi-role authentication (ADMIN, USER) with JWT session cookies and secure scrypt password hashing — `src/lib/auth.ts`, `src/lib/passwords.ts`
- ✓ Dealership branch and consultant allocation with calendar follow-up scheduling — `src/app/dashboard/page.tsx`, `src/app/calendar/page.tsx`
- ✓ Web Push notifications (VAPID) and background worker alerts for new leads — `src/lib/notifications.ts`, `src/instrumentation.ts`
- ✓ Full persistent lead activity audit logging — `src/lib/activity.ts`
- ✓ PDF report export and Excel sheet data import/export — `src/components/ExternalUploadModal.tsx`, `jspdf`, `xlsx`
- ✓ Bi-directional Google Sheets synchronization engine with row hashing — `src/lib/sync.ts`, `src/lib/google.ts`
- ✓ **BRANCH-01 / 02 / 03**: Branches data model, CRUD API, and dedicated `/branches` view — `src/app/branches/page.tsx`, `src/app/api/branches/route.ts`
- ✓ **LOC-01 / 02**: Built-in Tamil Nadu location dictionary with typo-tolerant fuzzy string matching — `src/lib/location/matcher.ts`, `src/lib/location/tn-locations.ts`
- ✓ **LOC-03 / GEO-01 / 02 / 03**: Geocoding fallback with persistent DB location cache (`LocationCache`) and queue throttling — `src/lib/location/geocoder.ts`
- ✓ **ROUTE-01 / 02 / 03**: Nearest-branch routing engine via Haversine calculation with out-of-state fence and audit trail — `src/lib/location/routing.ts`
- ✓ **INGEST-01 / 02 / 03**: Lead ingestion pipeline integration across Google Sheets sync, Excel upload modal, and webhooks — `src/lib/sync.ts`, `src/components/ExternalUploadModal.tsx`, `src/app/api/webhooks/lead/route.ts`

### Active

- [ ] **BRCH-01**: Interactive branch dropdown in the leads table populated with all branches created from the `/branches` tab.
- [ ] **BRCH-02**: Default dropdown selection reflects the branch auto-assigned from the estimated location of the user (or "Unassigned" if unmapped).
- [ ] **BRCH-03**: Any logged-in user can change the branch for a lead in both the desktop table view and mobile card view.
- [ ] **BRCH-04**: Interactive confirmation prompt before clearing an assigned consultant when reassigning branch.
- [ ] **BRCH-05**: Persistent database update via `PATCH /api/leads/[id]` with optimistic updates and error rollback.
- [ ] **BRCH-06**: Full audit logging of branch changes into `LeadActivity` visible to Superadmin in logs viewer, strictly hiding Superadmin activities.

### Out of Scope

- Real-time GPS driver tracking — CRM focus is on lead intake and branch assignment, not transit tracking.
- Direct customer SMS gateway — Notifications currently handled via Web Push and consultant CRM dashboard.
- Live traffic distance matrix routing — Great-circle (Haversine) distance is computationally efficient, deterministic, and sufficient for branch catchment zones.

## Context

Following Milestone v1.0, incoming Tata leads are automatically routed to the nearest branch based on customer location. However, sales staff and managers need the ability to directly view and override a lead's branch in the main leads table via a dropdown populated with all branches registered in the `/branches` tab. Branch changes made by users must be logged and viewable by Superadmin in the audit logs viewer, while Superadmin actions remain completely hidden. If a lead already has an assigned consultant when changing branches, the user must be prompted for confirmation before clearing the consultant assignment.

## Constraints

- **Security & Privacy**: Superadmin actions must NEVER be tracked or surfaced in audit logs.
- **Data Integrity**: Changing a branch must update the database atomically and cleanly reflect across cached lead states.
- **User Experience**: Branch dropdown must be responsive, modern, fast, and feature inline confirmation dialogs for consultant clearance without breaking table layout.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Any logged-in user can reassign branch | Maximizes staff velocity and flexibility when customer re-allocations are required | — Pending |
| Prompt confirmation before clearing consultant | Prevents accidental orphaned consultant assignments across differing branches | — Pending |
| Superadmin logs strictly hidden | Strict business rule: Superadmin actions must leave zero trace in audit logs | — Validated |
| Populate dropdown from `/api/branches` DB entries | Ensures dynamic reflection of all branches created in the Branches management tab | — Pending |

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
*Last updated: 2026-09-15 after milestone v1.1 initialization*
