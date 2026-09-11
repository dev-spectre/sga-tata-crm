---
phase: "4"
slug: "geocoding-fallback-service-location-cache"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-11"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Prisma CLI + Node.js test runner + TypeScript compiler |
| **Config file** | `prisma/schema.prisma`, `tsconfig.json` |
| **Quick run command** | `npx prisma validate && npx tsc --noEmit` |
| **Full suite command** | `npx prisma validate && npx tsc --noEmit && node --test test/geocoder.test.mjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && node --test test/geocoder.test.mjs`
- **Before `/gsd-verify-work`:** Full suite must pass green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | LOC-03 | T-04-01 | `LocationCache` schema with unique search term | schema | `npx prisma validate` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | LOC-03 | T-04-02 | Database push and Prisma client types compiled | db | `npx prisma generate && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | GEO-01, GEO-02 | T-04-03 | Rate-limiting serial queue throttles external calls | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 2 | GEO-03 | T-04-04 | Tiered lookup checks dictionary -> cache -> geocoder and writes back | integration | `node --test test/geocoder.test.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all Prisma validations and Node test execution.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
