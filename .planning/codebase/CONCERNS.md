# Codebase Concerns

**Analysis Date:** 2026-09-11

## Tech Debt

**Monolithic Page Components:**
- Issue: Several frontend views exceed 1,000–2,700 lines of code, combining complex UI markup, local state hooks, data fetching, formatting, inline spreadsheet logic, and PDF export into single files.
- Files: `src/app/dashboard/page.tsx` (2,705 lines), `src/app/activity/page.tsx` (1,652 lines), `src/app/consultants/page.tsx` (1,631 lines), `src/app/settings/page.tsx` (1,403 lines), `src/components/ExternalUploadModal.tsx` (1,155 lines), `src/app/accounts/page.tsx` (1,051 lines).
- Impact: High risk of regressions during feature development, steep cognitive ramp-up, and potential component re-rendering performance bottlenecks.
- Fix approach: Refactor pages by extracting discrete UI components (table, filter bar, modals, stat widgets) and custom hooks (e.g., `useLeadFilters`, `useLeadSync`).

**In-Memory Process Caches:**
- Issue: State caching for Google Sheet hashes (`cachedSheetHash`, `cachedRowHashes` in `src/lib/sync.ts`), push subscriptions (`cachedSubscriptions` in `src/lib/notifications.ts`), and push payloads (`lastSentPayloads`) rely on module-level in-memory variables.
- Files: `src/lib/sync.ts`, `src/lib/notifications.ts`, `src/lib/settings.ts`.
- Impact: In multi-instance or serverless container deployments, caches are not shared, causing redundant Google Sheet queries or duplicate push notifications across nodes.
- Fix approach: Utilize Redis or persistent database timestamps for distributed coordination when scaling horizontally.

## Known Bugs

**Fallback Secret in Production Auth:**
- Symptoms: If `JWT_SECRET` is inadvertently left unset in the environment, the application falls back to `'fallback-secret-change-me'`.
- Files: `src/proxy.ts`, `src/lib/auth.ts`.
- Trigger: Missing environment variable in production.
- Workaround: Server logs a warning, but application continues to boot.
- Fix approach: Enforce strict startup validation that throws a fatal error if `JWT_SECRET` is not set or matches the fallback string when `NODE_ENV === 'production'`.

## Security Considerations

**Role Access Enforcement in API Routes:**
- Risk: Non-admin users attempting to modify leads belonging to other branches or consultants.
- Files: `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts`, `src/app/api/leads/[id]/remark/route.ts`.
- Current mitigation: Handlers retrieve `getCurrentUser()` and verify role (`ADMIN` vs `USER`), scoping query filters by `assignedBranch` when not admin.
- Recommendations: Centralize authorization checks into a dedicated helper (e.g., `assertBranchAccess(user, lead)`) to ensure consistency across all sub-routes.

**Google OAuth Token Persistence:**
- Risk: Refresh tokens stored in plaintext in the `Settings` database table (`googleRefreshToken`).
- Files: `prisma/schema.prisma`, `src/lib/google.ts`.
- Current mitigation: Restricted access to database and `/api/settings` endpoint.
- Recommendations: Encrypt stored OAuth tokens using AES-256-GCM before writing to the database table.

## Performance Bottlenecks

**Full Table Scans during Deduplication and Export:**
- Problem: Large lead volumes can slow down deduplication and reporting queries.
- Files: `src/lib/deduplicate.ts`, `src/app/api/leads/route.ts`.
- Cause: Queries filtering across multiple dynamic fields (`city`, `branch`, `consultant`, `status`, date ranges) without composite indexes for every combination.
- Improvement path: Ensure indexed fields (`createdAt`, `status`, `branch`, `fingerprint`) are leveraged in query execution plans; introduce composite indexes in `prisma/schema.prisma` for frequent compound filters.

## Fragile Areas

**Background Loop in Serverless Runtimes:**
- Files: `src/instrumentation.ts`, `src/lib/notifications.ts`.
- Why fragile: Background `setInterval` scheduling requires a persistent, long-running Node.js process. In serverless environments (e.g., AWS Lambda, Vercel), processes freeze between invocations, which halts the notification loop.
- Safe modification: Retain the instrumentation loop for containerized Node.js deployments, but provide an external HTTP cron trigger (`/api/notifications/check` and `/api/sheets/sync`) for serverless deployments.
- Test coverage: Untested.

**External Google Sheets Schema Drift:**
- Files: `src/lib/sync.ts`, `src/lib/mapping.ts`.
- Why fragile: If a user alters column orders or headers in the connected Google Sheet without updating `Settings.columnMapping`, sync may ingest corrupted lead records or fail silently.
- Safe modification: Validate header names against expected keys before executing batch row reads; alert admins upon schema mismatch.

## Scaling Limits

**Google Sheets API Quota:**
- Current capacity: Google Cloud standard quota limits read requests to 60 per minute per user and 300 per minute per project.
- Limit: Frequent polling combined with multiple concurrent users triggering manual syncs can trigger HTTP 429 Rate Limit Exceeded.
- Scaling path: Implement exponential backoff, increase the default polling interval (currently 15 minutes), and maintain row hash diffing.

**Database Connection Pool Exhaustion:**
- Current capacity: Capped at 15 connections (`max: 15`) in `src/lib/prisma.ts`.
- Limit: Exceeded if concurrent API requests spike alongside long-running sheet sync transactions.
- Scaling path: Use dedicated PgBouncer / Neon transaction pooling and minimize connection hold time during external HTTP calls.

## Dependencies at Risk

**`better-sqlite3` and `@prisma/adapter-better-sqlite3`:**
- Risk: Native C++ bindings (`better-sqlite3`) included in `package.json` while production database is PostgreSQL.
- Impact: Increases container build times and may cause native compilation issues in non-glibc container environments (e.g., Alpine Linux).
- Migration plan: Remove SQLite dependencies if local SQLite mode is no longer actively used, keeping only PostgreSQL adapters.

## Missing Critical Features

**Automated Test Suite:**
- Problem: Zero automated unit, integration, or regression tests in the codebase.
- Blocks: Safe major refactoring of large page components and continuous delivery confidence.

## Test Coverage Gaps

**Authentication & Session Guarding:**
- What's not tested: Token generation, expiration, cookie parsing, impersonation privilege elevation, and invalid token rejection.
- Files: `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/passwords.ts`.
- Risk: Potential security regressions during proxy or Next.js upgrades.
- Priority: High

**Google Sheets Sync & Lead Deduplication:**
- What's not tested: Parsing of various phone number formats, edge cases in fingerprint generation, row diffing, and sheet write-backs.
- Files: `src/lib/sync.ts`, `src/lib/deduplicate.ts`, `src/lib/mapping.ts`, `src/lib/utils.ts`.
- Risk: Ingestion of corrupted leads or failure to synchronize lead statuses back to Google Sheets.
- Priority: High

**Lead API RBAC Scoping:**
- What's not tested: Verifying that branch-restricted users cannot query or mutate leads from unauthorized branches.
- Files: `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts`.
- Risk: Data leakage across dealership branches.
- Priority: High

---

*Concerns audit: 2026-09-11*
