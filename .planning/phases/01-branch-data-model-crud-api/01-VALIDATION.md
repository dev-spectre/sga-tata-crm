---
phase: "1"
slug: "branch-data-model-crud-api"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-11"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Prisma CLI + ESLint 9 + Node.js HTTP test script |
| **Config file** | `prisma.config.ts`, `eslint.config.mjs` |
| **Quick run command** | `npx prisma validate && npm run lint` |
| **Full suite command** | `npx prisma validate && npx prisma generate && npm run lint` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx prisma validate && npm run lint`
- **After every plan wave:** Run `npx prisma validate && npx prisma generate && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | BRANCH-01 | T-01-01 | Valid coordinates and unique branch code enforced | schema | `npx prisma validate && npx prisma generate` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 2 | BRANCH-03 | T-01-02 | RBAC: Only ADMIN/SUPERADMIN can create or delete branches | api | `npm run lint` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 2 | BRANCH-03 | T-01-03 | Soft-delete prevents data loss; dual-mode API returns both formats | api | `npm run lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all phase requirements (Prisma schema validation and TypeScript linting).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dual-format response | BRANCH-03 | Requires active HTTP server | Verify `GET /api/branches` returns `{ branches: Branch[] }` and `GET /api/branches?format=names` returns `{ branches: string[] }` |
| Soft-delete behavior | BRANCH-03 | Verified in Prisma Studio / DB | Call `DELETE /api/branches/[id]` and check `isActive` is `false` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
