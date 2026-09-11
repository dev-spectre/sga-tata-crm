# Phase 4: Geocoding Fallback Service & Rate-Limited Location Cache - Context

**Gathered:** 2026-09-11
**Status:** Ready for execution

<domain>
## Phase Boundary

Delivers a resilient, rate-limited external geocoding service with persistent PostgreSQL database caching (`LocationCache` model) to handle locations not resolved by the local Tamil Nadu dictionary. Protects against rate limits and billing surprises with serial throttling, while ensuring that previously queried locations are never repeatedly requested from external APIs.
</domain>

<decisions>
## Implementation Decisions

### Cache Schema & Persistence
- **D-01:** `LocationCache` Prisma Model. Persists sanitized search terms, canonical name, district, state, latitude, longitude, and provider source (`nominatim` | `google` | `manual`). Search term enforces `@unique` with case-insensitive normalization. — **Reversibility:** one-way (schema migration).

### External Provider Integration
- **D-02:** Hybrid Geocoding Provider:
  - If `GOOGLE_GEOCODING_API_KEY` is set in environment, use Google Maps Geocoding API (`https://maps.googleapis.com/maps/api/geocode/json?address=...`).
  - Otherwise, seamlessly fall back to OpenStreetMap Nominatim API (`https://nominatim.openstreetmap.org/search?format=json&q=...&countrycodes=in&limit=1`) with mandatory application `User-Agent: SGA-Tata-CRM/1.0`. — **Reversibility:** reversible.

### Rate Limiting & Concurrency Throttling
- **D-03:** Serial Rate-Limiting Queue. Maintain an asynchronous queuing mechanism ensuring a minimum 1,000ms delay between consecutive external requests to strictly adhere to Nominatim usage policies and throttle Google API calls during bulk lead ingestion. — **Reversibility:** reversible.

### Tiered Lookup Order
- **D-04:** Unified Location Resolver Order:
  1. Local Tamil Nadu Dictionary & Fuzzy Matcher (Phase 3) — < 0.1ms, zero cost.
  2. PostgreSQL `LocationCache` Table lookup — < 5ms DB query.
  3. Rate-limited External Geocoding (Google / Nominatim) + immediate DB write.
  4. Out-of-state detection: If resolved state is not "Tamil Nadu" (or "Puducherry" adjacent), tag as out-of-state for downstream Phase 5 handling. — **Reversibility:** reversible.
</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — `LOC-03`, `GEO-01`, `GEO-02`, `GEO-03`
- `.planning/ROADMAP.md` — Phase 4 success criteria
- `prisma/schema.prisma` — Schema definitions

### Target Modules
- `prisma/schema.prisma` — `LocationCache` model
- `src/lib/prisma.ts` — Extended client support for `locationCache`
- `src/lib/location/geocoder.ts` — Rate-limited geocoding service and tiered resolver
</canonical_refs>
