# Phase 10: Tamil Nadu Geocoding Bounding & Spatial Verification - Context

**Phase:** 10-tamil-nadu-geocoding-bounding-spatial-verification
**Milestone:** v1.2
**Status:** In Progress

## Phase Intent

External geocoding queries (when local dictionary and location cache miss) must focus strictly on Tamil Nadu. Currently, ambiguous queries (such as "MG Road" or "Gandhi Nagar") could inadvertently match locations outside Tamil Nadu in other states (e.g. Karnataka, Kerala, Maharashtra) if not explicitly restricted.

By applying geographic bounding coordinates:
1. **OSM Nominatim**: Pass `viewbox=76.23,13.55,80.35,8.08&bounded=1` so matches outside this box are eliminated.
2. **Google Maps Geocoding API**: Pass `bounds=8.08,76.23|13.55,80.35` and `components=administrative_area:Tamil Nadu|country:IN` so results are biased/restricted to Tamil Nadu.
3. **Spatial Verification Guard**: Even if an external geocoder returns a result or if an ambiguous name was cached, verify `isPointInTamilNaduBoundingBox(lat, lon)`:
   - Latitude: `8.08 <= lat <= 13.55`
   - Longitude: `76.23 <= lon <= 80.35`
   - If outside, `isTamilNadu` is strictly set to `false`.
4. **Routing Engine**: When `isTamilNadu === false`, the lead is classified as `out_of_state` and branch is set to Unassigned (`""`).

## Affected Files
- `src/lib/location/geocoder.ts`
- `src/lib/location/routing.ts`
