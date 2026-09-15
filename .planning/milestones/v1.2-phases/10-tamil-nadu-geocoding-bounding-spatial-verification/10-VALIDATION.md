# Phase 10: Tamil Nadu Geocoding Bounding & Spatial Verification - Validation

**Phase:** 10-tamil-nadu-geocoding-bounding-spatial-verification
**Milestone:** v1.2

## Acceptance Criteria

1. **Bounding Rectangle Constants**:
   - `TAMIL_NADU_BOUNDS` defined with min/max lat (`8.08` to `13.55`) and min/max lon (`76.23` to `80.35`).
   - `isCoordinatesInTamilNadu(lat, lon)` helper accurately checks bounding box constraints.

2. **External Geocoding Query Parameters**:
   - `queryNominatim` appends `viewbox=76.23,13.55,80.35,8.08&bounded=1`.
   - `queryGoogleGeocode` appends `bounds=8.08,76.23|13.55,80.35` and `components=administrative_area:Tamil Nadu|country:IN`.

3. **Spatial Verification Guard in Tiered Resolver**:
   - For all external responses and cache lookups, coordinates are checked against `isCoordinatesInTamilNadu(lat, lon)`.
   - If outside bounds or state name is not Tamil Nadu/Puducherry, `isTamilNadu` evaluates to `false`.

4. **Integration & Automated Verification**:
   - Automated script tests querying locations inside TN (e.g. Coimbatore, Madurai) vs outside TN (e.g. Bengaluru, Mumbai, Delhi).
   - Confirms outside-state queries return `isTamilNadu: false` and are rejected as `out_of_state` by routing.
   - `npx tsc --noEmit` exits with 0 errors.
