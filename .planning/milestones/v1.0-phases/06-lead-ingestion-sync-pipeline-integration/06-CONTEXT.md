# Phase 6: Lead Ingestion & Sync Pipeline Integration - Context

**Gathered:** 2026-09-12
**Status:** Ready for execution

<domain>
## Phase Boundary

Integrates the nearest-branch routing engine (`src/lib/location/routing.ts`) directly into all three ingestion pipelines:
1. Google Sheets background synchronization (`src/lib/sync.ts`)
2. Manual Excel/CSV external upload (`src/app/api/sheets/external/route.ts` and `src/components/ExternalUploadModal.tsx`)
3. Inbound direct lead webhook (`src/app/api/webhooks/lead/route.ts`)

Removes the prerequisite for an explicit branch column in incoming sheets (adapted from the original Skoda schema to the Tata dealership workflow where only city/location and optional zipcode exist). Guarantees branch assignment persistence, manual override protection, and visual flagging for unassigned/out-of-state leads in the CRM dashboard.
</domain>

<decisions>
## Implementation Decisions

### Google Sheets Sync Adaptation
- **D-01:** Remove Branch Prerequisite:
  - In `src/lib/sync.ts`, treat `mapping.branch` as optional. If absent or empty in a sheet row, resolve the row's `city` (location/zipcode) against active branches via `routeLeadToBranch`.
  - Assign `lead.branch = routing.assignedBranch.name` if resolved.
  - Strict Override Protection: If an existing lead already has `branch` set, never overwrite it with an empty value during sync reconciliation. — **Reversibility:** reversible.

### External Excel/CSV Upload Integration
- **D-02:** Bulk External Upload Routing:
  - In `src/app/api/sheets/external/route.ts`, if uploaded row lacks a branch value, resolve location via `routeLeadToBranch`.
  - In `src/components/ExternalUploadModal.tsx`, update column header guessing so "Location", "City", "Zipcode", "Pincode" map to `city`, and remove "location" from branch hints. — **Reversibility:** reversible.

### Inbound Webhook Routing
- **D-03:** Real-time Webhook Auto-Assignment:
  - In `src/app/api/webhooks/lead/route.ts`, if `branch` is empty/omitted, auto-resolve via `routeLeadToBranch(parsedCity)` and record `logRoutingActivity`. — **Reversibility:** reversible.

### Dashboard Visual Tagging
- **D-04:** Highlight Unassigned / Out-of-State Leads:
  - In `src/app/dashboard/page.tsx`, if a lead has no assigned branch, display a distinct red badge labeled "Unassigned" with tooltip context rather than an ambiguous dash `"—"`. — **Reversibility:** reversible.
</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — `INGEST-01`, `INGEST-02`, `INGEST-03`
- `.planning/ROADMAP.md` — Phase 6 success criteria

### Target Modules
- `src/lib/sync.ts` — Google Sheets synchronization
- `src/app/api/sheets/external/route.ts` — External Excel/CSV import handler
- `src/components/ExternalUploadModal.tsx` — Modal column mapping UI
- `src/app/api/webhooks/lead/route.ts` — Webhook ingestion endpoint
- `src/app/dashboard/page.tsx` — Dashboard lead table badge display
</canonical_refs>
