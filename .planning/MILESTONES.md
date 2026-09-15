# Milestones

## v1.2 Tamil Nadu Geocoding Optimization & Multi-Category Lead Views (Shipped: 2026-09-15)

**Phases completed:** 3 phases (Phases 10-12), 6 plans

**Key accomplishments:**

- Tamil Nadu bounding box coordinates applied to Nominatim (`viewbox`) and Google Geocoding API (`bounds`, `components`).
- Spatial boundary validator rejecting coordinates outside Tamil Nadu as out-of-state and keeping leads unassigned.
- 3-category lead taxonomy (`Priority`, `Valid`, `Unassigned`) with IST end-of-day boundary logic.
- Optimized parallel stats calculation returning real-time lead counts across all categories.
- Modern segmented category switcher tab bar rendered above leads table in desktop view and mobile card view.
- Live badge counters, contextual scope helper hint, and seamless URL query parameter / localStorage persistence.

---

## v1.1 Lead Table Interactive Branch Selection & Override (Shipped: 2026-09-15)

**Phases completed:** 3 phases (Phases 7-9), 5 plans

**Key accomplishments:**

- Interactive branch dropdown in desktop leads table and mobile cards populated exclusively from Branch Manager.
- Auto-selection defaults to branch mapped from customer's estimated location.
- Confirmation safeguard modal preventing unintended consultant clearance when switching branches.
- Atomic backend updates supporting branch re-assignment and consultant clearance with optimistic UI rollback.
- Full audit logging (`BRANCH_CHANGE`) for staff actions with strict Superadmin invisibility.

---

## v1.0 Tata Location-Based Auto Branch Assignment (Shipped: 2026-09-12)

**Phases completed:** 6 phases (Phases 1-6), 12 plans

**Key accomplishments:**

- Branches data model and dedicated management UI (`/branches`).
- Offline-first Tamil Nadu location dictionary with typo-tolerant fuzzy matching.
- Rate-limited external geocoding service with persistent database location cache (`LocationCache`).
- Nearest-branch routing engine using Haversine geodesic calculation.
- Automated location resolution across Google Sheets sync, Excel upload, and webhook pipelines.

---
