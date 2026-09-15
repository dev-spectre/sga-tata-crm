# Phase 1: Branch Data Model & CRUD API - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Establishes the authoritative database data model (`Branch` in Prisma) and full RESTful CRUD API endpoints (`/api/branches`, `/api/branches/[id]`) for dealership branches in SGA Tata CRM. Replaces ad-hoc string grouping with a structured branch master that includes geographic coordinates, address, status, and role-based access controls.
</domain>

<decisions>
## Implementation Decisions

### Legacy Migration & Seeding
- **D-01:** Start with an empty `Branch` table. Do not automatically dump legacy free-text branch strings into the new table. Administrators will create authoritative branches with complete physical addresses, cities, and verified GPS coordinates via the UI. — **Reversibility:** costly — avoids corrupting the authoritative branch master with legacy typos.

### API Architecture & Compatibility
- **D-02:** Dual-mode response on `GET /api/branches`. By default, return full `Branch` objects (`{ branches: Branch[] }`) with `id`, `name`, `code`, `address`, `city`, `latitude`, `longitude`, `radiusKm`, and `isActive`. Support query parameter `?format=names` returning `{ branches: string[] }` (or dual keys `{ branches: string[], branchList: Branch[] }`) to ensure zero breakage for existing filter dropdowns and `BranchConsultantPicker`. — **Reversibility:** reversible.

### Branch Lifecycle & Deletion Safety
- **D-03:** Soft-delete and active status toggle (`isActive: Boolean @default(true)`). Do not physically delete branches that have historical leads, consultants, or users linked. Inactive branches are excluded from auto-routing and consultant assignment dropdowns, while preserving past lead histories. — **Reversibility:** one-way — requires Prisma schema design with soft-deactivation column.

### Coordinate Input & Validation
- **D-04:** Auto-geocoding on save with manual override. When saving a branch with address and city, attempt to auto-resolve latitude and longitude, while providing input fields for administrators to inspect, fine-tune, or manually override the exact GPS pin. — **Reversibility:** reversible.

### Identification & Constraints
- **D-05:** Unique branch `code` (e.g., `CBE-MAIN`, `MTP`, `SLM-WEST`) required on creation alongside unique `name`. The schema enforces `@unique` on both `name` and `code`. — **Reversibility:** one-way — database unique constraint and migration.

### Role-Based Access Control
- **D-06:** Full branch creation, deletion/deactivation, and configuration rights reserved for `ADMIN` / `SUPERADMIN`. Assigned branch managers (`User.assignedBranch === branch.name`) can edit their assigned branch's contact details and address/coordinates. — **Reversibility:** reversible.

### Downstream Routing Rules (Contract for Phase 4–6)
- **D-07:** Nearest branch fallback within Tamil Nadu: Always assign to the closest active branch even if beyond `radiusKm`, recording the calculated distance in `LeadActivity`.
- **D-08:** Out-of-State / Border Fence: If a lead's resolved location is outside Tamil Nadu (different state or significantly far from the border), do NOT assign to any branch. Keep `branch: ""` (unassigned) and flag the lead with an out-of-state red indicator in the UI.
- **D-09:** Eager vs Lazy Execution: Eagerly resolve and assign leads arriving via webhooks. For bulk leads, evaluate and map lazily only when leads are loaded and displayed in the frontend, leveraging local DB cache and strict rate limiting to avoid API exhaustion.
- **D-10:** Manual Override Protection: If a user manually assigns or alters a lead's branch, lock the assignment to invalidate and prevent future auto-remapping from overwriting it.

### Agent Discretion
- Field types and precision: Use `Float` for `latitude` and `longitude`, `Float` with default `50.0` for `radiusKm`.
- Error handling & validation: Standard 400 Bad Request responses with detailed field validation messages for duplicate names/codes or malformed coordinates.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Architecture
- `.planning/PROJECT.md` — Project context, core values, active requirements
- `.planning/REQUIREMENTS.md` — Requirement definitions for `BRANCH-01` and `BRANCH-03`
- `.planning/ROADMAP.md` — Phase 1 scope and success criteria
- `.planning/codebase/ARCHITECTURE.md` — System architecture and Prisma client patterns
- `.planning/codebase/CONVENTIONS.md` — API route patterns, error handling, and naming conventions

### Schema & Handlers
- `prisma/schema.prisma` — Existing models (`Lead`, `User`, `Consultant`, `Settings`)
- `src/app/api/branches/route.ts` — Existing ad-hoc branch aggregation endpoint to be upgraded
- `src/lib/auth.ts` — Role extraction and session authentication helpers
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/prisma.ts`: Prisma client with dynamic Neon/PgPool adapters.
- `src/lib/auth.ts`: `getCurrentUser()` for role and assigned branch validation.
- `src/lib/utils.ts`: String sanitization and parsing utilities.

### Established Patterns
- Next.js 16 App Router route handlers in `src/app/api/` with `export async function GET/POST/PUT/DELETE(request: NextRequest)`.
- HTTP status codes: 200/201 on success, 400 on validation error, 401 on missing session, 403 on forbidden action, 500 on server error.

### Integration Points
- `prisma/schema.prisma`: Add `model Branch`.
- `src/app/api/branches/route.ts`: Upgrade `GET` and add `POST`.
- `src/app/api/branches/[id]/route.ts`: Add `GET`, `PUT`, `DELETE` (soft-delete toggle).
</code_context>

<specifics>
## Specific Ideas

- When an admin saves a branch, allow auto-geocoding via OpenStreetMap/Nominatim or Google Geocoding with fallback to manual pin entry.
- Preserve legacy `{ branches: string[] }` format via `?format=names` parameter so current frontend pickers don't break during Phase 1.
- Mark out-of-state leads with a distinct red alert status so staff know they require special handling.
</specifics>

<deferred>
## Deferred Ideas

- Interactive Leaflet/Google Map picker for visual pin dropping on branches (Phase 2).
- Dynamic lead redistribution based on branch staff workload capacity (v2).
</deferred>

---

*Phase: 01-Branch Data Model & CRUD API*
*Context gathered: 2026-09-11*
