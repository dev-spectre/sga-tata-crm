# Phase 2: Branches Management UI - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Delivers the dedicated frontend user interface (`/branches`) in SGA Tata CRM allowing dealership administrators to view, create, edit, search, and toggle the active status of dealership branches. Integrates with the backend CRUD API endpoints (`/api/branches` and `/api/branches/[id]`) delivered in Phase 1, and embeds the navigation route in `Sidebar.tsx`.
</domain>

<decisions>
## Implementation Decisions

### Navigation & Placement
- **D-01:** Add `/branches` link to `src/components/Sidebar.tsx` in the administrative section (alongside User Activity, Consultants, and Accounts). Restricted to administrative users (`ADMIN` / `SUPERADMIN`) in accordance with Phase 1 RBAC rules (Decision D-06). — **Reversibility:** reversible.

### Branches View Architecture
- **D-02:** Build `src/app/branches/page.tsx` as a client-rendered dashboard view following the established design tokens (`var(--primary)`, `var(--bg-glass)`, `var(--border)`, Tata blue accents). Includes summary stat metric cards: Total Branches, Active Branches, Inactive Branches, and Coordinated Branches (branches with valid lat/long configured). — **Reversibility:** reversible.

### Search & Filtering
- **D-03:** Real-time client-side filter supporting text search across branch name, branch code, city, and address, paired with status tabs/dropdown (All, Active, Inactive). — **Reversibility:** reversible.

### Coordinate Input & Validation
- **D-04:** Provide dedicated Latitude and Longitude input fields with validation ranges (latitude: [-90, 90], longitude: [-180, 180]). Include a "Use My Location" browser geolocation button for easy coordinate capture on-site, and an external Google Maps link (`https://www.google.com/maps?q=${lat},${lng}`) to inspect/verify pins. — **Reversibility:** reversible.

### Soft-Delete Confirmation
- **D-05:** Soft-delete (deactivation) confirmed via dedicated modal dialog that clearly informs the administrator that historical leads and consultants will not lose their branch association, but auto-routing will no longer route new leads to this branch. — **Reversibility:** reversible.

### Error Handling & Feedback
- **D-06:** Handle API conflict responses (409 on duplicate name or code) directly within the modal, surfacing clear field-level error messages without closing the modal or losing entered details. Surface operations feedback via toast alerts. — **Reversibility:** reversible.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/PROJECT.md` — Project mission, constraints, and architecture overview
- `.planning/REQUIREMENTS.md` — Requirement `BRANCH-02`
- `.planning/ROADMAP.md` — Phase 2 success criteria and deliverables
- `.planning/phases/01-branch-data-model-crud-api/01-02-SUMMARY.md` — Phase 1 CRUD API contracts and endpoints

### Codebase Components & Styles
- `src/components/Sidebar.tsx` — Dashboard navigation drawer and links
- `src/app/globals.css` — Design tokens, card styles, tables, and modal styling
- `src/app/accounts/page.tsx` — Reference implementation for admin CRUD management views
- `src/app/api/branches/route.ts` — GET / POST route handler
- `src/app/api/branches/[id]/route.ts` — GET / PUT / DELETE route handler
</canonical_refs>
