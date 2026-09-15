# Phase 1: Branch Data Model & CRUD API - Discussion Log

**Date:** 2026-09-11
**Phase:** 1 - Branch Data Model & CRUD API

## Questions and Outcomes

### 1. Legacy Branch Migration
- **Question:** How should existing branch names currently in leads, consultants, and users be populated into the new Branch table?
- **Options Presented:**
  1. Auto-seed distinct existing branch names into the Branch table with placeholder coordinates
  2. Start empty — Require administrators to create branches fresh with complete address and coordinates via the new UI
  3. Auto-seed and attempt automatic geocoding of existing branch names
- **Outcome Selected:** Start empty — Require administrators to create branches fresh with complete address and coordinates via the new UI.
- **Notes:** Prevents polluting the new authoritative branch master with legacy typographical inconsistencies.

### 2. API Response & Compatibility
- **Question:** How should GET /api/branches deliver branch data to support both the new management UI and existing branch pickers?
- **Options Presented:**
  1. Dual support via query param — Default to full Branch objects for the new UI, support ?format=names for existing dropdowns
  2. Full Branch objects everywhere — Return { branches: Branch[] } and update existing picker/filter components
  3. Separate endpoints — /api/branches for full objects, /api/branches/names for legacy consumers
- **Outcome Selected:** Dual support via query param — Default to full Branch objects (`{ branches: Branch[] }`) for the new UI, support `?format=names` for existing dropdowns.
- **Notes:** Zero breaking changes across current dashboard filters, `BranchConsultantPicker`, and reports.

### 3. Branch Lifecycle & Deletion Safety
- **Question:** How should branch deletion or deactivation be handled when consultants or leads are linked to the branch?
- **Options Presented:**
  1. Soft-delete / Toggle Active — Set isActive: false so inactive branches are excluded from routing, but historical leads/consultants retain their history
  2. Block deletion if referenced — Disallow deleting a branch if consultants or leads are assigned
  3. Soft-delete by default, with an explicit hard-delete confirmation if completely unused
- **Outcome Selected:** Soft-delete / Toggle Active (`isActive = false`).
- **Notes:** Safeguards database referential integrity.

### 4. Coordinate Input & Validation
- **Question:** How should coordinates (latitude/longitude) be gathered and validated when creating or editing a branch?
- **Options Presented:**
  1. Auto-geocoding with manual override — Attempt to auto-fetch lat/long from branch address/city on save, allowing admins to manually adjust coordinates
  2. Draft mode — Coordinates optional at creation
  3. Strict validation — Require valid latitude and longitude numbers immediately upon creation
- **Outcome Selected:** Auto-geocoding with manual override.

### 5. Catchment Radius & Boundary Rules
- **Outcome:** Always assign to nearest branch within Tamil Nadu even if beyond `radiusKm`, logging distance.
- **Out-of-State Boundary Rule:** If a lead is outside Tamil Nadu (different state or far from border), keep unassigned (`branch: ""`) and highlight the lead in red color in the CRM UI.

### 6. Geocoding Rate Limiting & Execution Timing
- **Outcome:** Eagerly resolve and assign leads arriving via webhooks. For bulk leads, evaluate and map lazily only when leads are loaded and displayed in the frontend, using DB cache to avoid geocoding bursts.
- **Manual Override Precedence:** If a user manually assigns or alters a lead's branch, lock that assignment so automated routing never overwrites manual entries.

### 7. Branch Constraints & RBAC
- **Outcome:** Unique branch `code` required on creation. Full CRUD for ADMIN/SUPERADMIN; assigned branch managers can edit their assigned branch's contact details and coordinates.
