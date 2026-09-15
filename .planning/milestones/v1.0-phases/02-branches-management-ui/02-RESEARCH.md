# Phase 2: Branches Management UI - Research

**Analysis Date:** 2026-09-11
**Status:** Completed

<summary>
Investigated UI design tokens, navigation integration in Next.js App Router, form validation and coordinate input mechanisms, and interaction with the Phase 1 `/api/branches` endpoints.
</summary>

<standard_stack>
## Standard Stack & Technologies

### Frontend Components
- **Framework:** Next.js 16.2.12 (App Router, Client Components with `"use client"`)
- **Language:** TypeScript 5
- **Styling:** CSS variables defined in `src/app/globals.css` (Tata Blue palette: `--primary: #0072bc`, `--bg-darkest: #ffffff`, `--bg-glass: rgba(255, 255, 255, 0.85)`, `--border: rgba(148, 163, 184, 0.3)`)
- **Icons:** Inline SVG icons consistent with `Sidebar.tsx` and `accounts/page.tsx`
- **Geolocation Helper:** Native browser `navigator.geolocation.getCurrentPosition`
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Component Breakdown
1. **Sidebar Navigation Link (`src/components/Sidebar.tsx`):**
   - Place under admin section:
   ```tsx
   <Link
     href="/branches"
     onClick={() => setMobileOpen(false)}
     className={`sidebar-link ${pathname === "/branches" ? "active" : ""}`}
   >
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
       <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v2M12 14v2M16 14v2" />
     </svg>
     Branches
   </Link>
   ```

2. **Main Page Component (`src/app/branches/page.tsx`):**
   - Manages state:
     - `branches: Branch[]` (loaded via `GET /api/branches?includeInactive=true`)
     - `loading: boolean`
     - `search: string`
     - `statusFilter: 'all' | 'active' | 'inactive'`
     - `createModalOpen: boolean`
     - `editBranch: Branch | null`
     - `deactivateBranch: Branch | null`
     - `toast: { message: string, type: 'success' | 'error' } | null`
   - Metric summary cards:
     - Total Branches
     - Active Branches
     - Inactive Branches
     - Mapped / Coordinated Branches (branches where `latitude !== null && longitude !== null`)

3. **Branch Modal (`src/app/branches/BranchModal.tsx`):**
   - Handles both Create and Edit modes.
   - Form fields:
     - `name`: string (required)
     - `code`: string (required, converted to uppercase)
     - `city`: string
     - `address`: string
     - `latitude`: number | null (range: -90 to 90)
     - `longitude`: number | null (range: -180 to 180)
     - `radiusKm`: number (default: 50.0, minimum: 1)
     - `isActive`: boolean (default: true)
   - Coordinate helper:
     - "Get My Current Location" button captures browser GPS if permitted.
     - "View on Maps" external link (`https://www.google.com/maps?q=${lat},${lng}`) when lat and lng are populated.
   - Handles conflict errors: displays 409 error message inline so user can modify code/name.

4. **Deactivate Confirmation Dialog:**
   - Explains that the branch will be marked inactive.
   - Calls `DELETE /api/branches/[id]` which executes soft-delete (`isActive: false`).
</architecture_patterns>

<risks_and_mitigations>
## Risks & Mitigations

### 1. Inactive Branches in Existing Dropdowns
- **Risk:** Inactive branches showing up in lead assignment or consultant dropdowns.
- **Mitigation:** `GET /api/branches` without `?includeInactive=true` filters out inactive branches (`where: { isActive: true }`). The `/branches` admin page explicitly requests `?includeInactive=true` to view and reactivate them.

### 2. Coordinate Precision & Range Violations
- **Risk:** Entering invalid latitude/longitude causing Haversine calculations in downstream Phase 5 to produce `NaN` or fail.
- **Mitigation:** Validate latitude [-90 to 90] and longitude [-180 to 180] before sending payload; also clean whitespace and parse as numeric float.

### 3. Non-Admin Access
- **Risk:** Non-admin staff navigating directly to `/branches`.
- **Mitigation:** Query `/api/auth/me`. If user is not `ADMIN` or `SUPERADMIN`, display access denied banner or redirect to `/dashboard`.
</risks_and_mitigations>
