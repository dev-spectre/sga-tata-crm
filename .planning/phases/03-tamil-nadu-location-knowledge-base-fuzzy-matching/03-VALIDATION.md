---
phase: "3"
slug: "tamil-nadu-location-knowledge-base-fuzzy-matching"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-11"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner + TypeScript compiler |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && node --test test/location-matcher.test.mjs` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && node --test test/location-matcher.test.mjs`
- **Before `/gsd-verify-work`:** Full suite must pass with 100% test vectors green and <5ms average latency
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | LOC-01 | T-03-01 | Comprehensive TN dataset with valid coordinates | schema | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | LOC-01 | T-03-02 | Pincode and alias hash tables accurately mapped | schema | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | LOC-02 | T-03-03 | Fuzzy matcher resolves typos (Levenshtein/transposition) | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | LOC-02 | T-03-04 | End-to-end lookup test suite passes with <5ms latency | benchmark | `node --test test/location-matcher.test.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all TypeScript type validations and test execution.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Colloquial nickname handling | LOC-02 | Natural language variations | Test queries like "kovai", "cbe gandhipuram", "trichy", "ooty charing cross" and verify canonical resolutions |
| Out-of-state rejection | LOC-02 | Downstream contract | Input "Bangalore", "Kochi", "Mumbai" and verify matcher returns `matched: false` so Phase 4/5 can flag |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
