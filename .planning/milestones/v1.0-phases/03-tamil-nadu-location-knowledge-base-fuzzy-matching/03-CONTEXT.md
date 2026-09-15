# Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Delivers an embedded, offline-first geographic knowledge base of Tamil Nadu locations along with an ultra-fast, typo-tolerant fuzzy matching engine. Enables resolving messy customer location strings (cities, towns, taluks, abbreviations, and pincodes) to canonical geographic coordinates in <5ms without external network latency, rate limits, or API costs.
</domain>

<decisions>
## Implementation Decisions

### Geographic Scope & Dataset Architecture
- **D-01:** Comprehensive Tamil Nadu Coverage. Embed all 38 districts with centroid coordinates, all municipal corporations and major towns, prominent taluks, and key automotive showroom catchments across Tamil Nadu. — **Reversibility:** reversible.
- **D-02:** Embedded JSON/TS Data Module (`src/lib/location/tn-locations.ts`). Keep the knowledge base in-memory as typed constant structures (`LocationNode[]`, `PincodeMap`, `AliasMap`) rather than database lookups for this tier, guaranteeing zero DB latency and zero connection overhead. — **Reversibility:** reversible.

### Multi-Tier Matching Pipeline
- **D-03:** 4-Stage Resolution Pipeline:
  1. **Pincode Lookup:** Direct hash map lookup for 6-digit Tamil Nadu postal codes (`600001` - `643999`).
  2. **Canonical & Alias Exact Match:** Normalized string lookup against canonical names and curated colloquial aliases (e.g. `cbe` -> Coimbatore, `kovai` -> Coimbatore, `trichy` -> Tiruchirappalli, `mdu` -> Madurai, `ooty` -> Udhagamandalam).
  3. **Token Substring Extraction:** Extraction of recognizable location words from multi-word address strings (e.g. "Gandhipuram, Coimbatore North").
  4. **Typo-Tolerant Fuzzy Matching:** Optimized edit-distance (Damerau-Levenshtein / bounded Levenshtein) with similarity thresholding (>=0.75 confidence) to catch spelling errors (e.g. "Madurei", "Coimbator", "Selam", "Tirupur"). — **Reversibility:** reversible.

### Performance & Latency Budgets
- **D-04:** Sub-5ms Execution SLA. The entire matching cascade must evaluate in under 5 milliseconds per query to allow synchronous resolution during lead ingestion and bulk sheet processing without choking event loops. — **Reversibility:** reversible.

### Downstream Integration Contract (For Phase 4 & 5)
- **D-05:** Result Contract:
  ```typescript
  export interface LocationMatchResult {
    matched: boolean;
    query: string;
    canonicalName: string;
    district: string;
    latitude: number;
    longitude: number;
    pincode?: string;
    matchType: 'pincode' | 'exact' | 'alias' | 'substring' | 'fuzzy';
    confidence: number; // 0.0 to 1.0
  }
  ```
  If `matched: false`, the downstream service in Phase 4 activates the external geocoding fallback.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/PROJECT.md` — Project mission and constraints
- `.planning/REQUIREMENTS.md` — Requirements `LOC-01` and `LOC-02`
- `.planning/ROADMAP.md` — Phase 3 success criteria and deliverables
- `.planning/phases/02-branches-management-ui/02-02-SUMMARY.md` — Phase 2 branches UI and coordinate structures

### Target Modules
- `src/lib/location/types.ts` — Type contracts for locations and matches
- `src/lib/location/tn-locations.ts` — Authoritative Tamil Nadu geographical dataset
- `src/lib/location/matcher.ts` — Fuzzy matching engine
</canonical_refs>
