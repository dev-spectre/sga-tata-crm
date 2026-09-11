---
phase: "2"
slug: "branches-management-ui"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-11"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript Compiler + Next.js build check + ESLint 9 |
| **Config file** | `tsconfig.json`, `eslint.config.mjs` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must pass cleanly
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BRANCH-02 | T-02-01 | Navigation link restricted to admin users | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | BRANCH-02 | T-02-02 | Branches page displays statistics, table, search, and status badges | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | BRANCH-02 | T-02-03 | Branch form validates coordinate bounds and handles 409 collisions | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | BRANCH-02 | T-02-04 | Soft-deactivation confirmation protects historical integrity | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all UI type definitions and component compilation (`npx tsc --noEmit`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar navigation | BRANCH-02 | Visual routing check | Click "Branches" in the sidebar as an admin and ensure `/branches` loads cleanly |
| Branch creation & editing | BRANCH-02 | Interactive modal workflow | Create a branch with name, code, coordinates, and verify it displays in the table; edit coordinates and verify change |
| Coordinate bounds validation | BRANCH-02 | Client input feedback | Enter latitude 95 or invalid string and verify warning message is presented |
| Soft-deactivation toggle | BRANCH-02 | State transition check | Toggle active/inactive and verify status badge updates to Inactive |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
