<!-- refreshed: 2026-09-11 -->
# Architecture

**Analysis Date:** 2026-09-11

## System Overview

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Client Layer (Browser)                                 │
│   • Dashboard (`src/app/dashboard/page.tsx`)        • Activity (`src/app/activity/`)   │
│   • Accounts (`src/app/accounts/page.tsx`)          • Consultants (`src/app/consultants/`)│
│   • Calendar (`src/app/calendar/page.tsx`)          • Settings (`src/app/settings/`)   │
│   • Service Worker (`public/sw.js`)                 • Login (`src/app/login/`)         │
└───────────────────────────┬──────────────────────────────────┬─────────────────────────┘
                            │ HTTP / Cookies (`sga-session`)    │ Push Notifications
                            ▼                                  ▲
┌──────────────────────────────────────────────────────────────┴─────────────────────────┐
│                           Edge & Request Guard Layer                                   │
│   • Request Proxy & Session Guard: `src/proxy.ts` (Next.js 16 proxy)                   │
│   • Session Token Verification: `jose` (JWT)                                           │
└───────────────────────────────────────────────────────────┬────────────────────────────┘
                                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              API Route Handlers Layer                                  │
│   • Auth & Impersonation: `src/app/api/auth/*`                                         │
│   • Leads Management & Dedup: `src/app/api/leads/*`                                    │
│   • Google Sheets Sync & Mapping: `src/app/api/sheets/*`                               │
│   • Inbound Webhooks: `src/app/api/webhooks/*`                                         │
│   • Administration & Audits: `src/app/api/admin/*`, `/api/users/*`, `/api/settings/*`  │
│   • Push Subscriptions & Alerts: `src/app/api/push/*`, `/api/notifications/*`          │
└───────────────────────────┬──────────────────────────────────┬─────────────────────────┘
                            │                                  │
                            ▼                                  ▼
┌─────────────────────────────────────────────────────┐  ┌───────────────────────────────┐
│             Core Business Logic Layer               │  │     Background Service        │
│   • Sheet Sync Engine: `src/lib/sync.ts`            │  │  • Instrumentation Startup:   │
│   • Google Sheets/Drive API: `src/lib/google.ts`    │  │    `src/instrumentation.ts`   │
│   • Dynamic Field Mapping: `src/lib/mapping.ts`     │  │  • Polling & Alert Dispatcher:│
│   • Deduplication Service: `src/lib/deduplicate.ts` │  │    `src/lib/notifications.ts` │
│   • User Sessions & RBAC: `src/lib/auth.ts`         │  └───────────────┬───────────────┘
│   • Activity Audit Logging: `src/lib/activity.ts`   │                  │
└───────────────────────────┬─────────────────────────┘                  │
                            │                                            │
                            ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           Data & Persistence Layer                                     │
│   • Dynamic Adapter Manager: `src/lib/prisma.ts`                                       │
│     - `PrismaNeon` (`@prisma/adapter-neon`) for Neon PostgreSQL                        │
│     - `PrismaPg` (`@prisma/adapter-pg` with `pg.Pool`) with Supabase port rewrites     │
│   • Schema & Migrations: `prisma/schema.prisma`                                        │
│   • External Google Cloud Services: Google Sheets API v4, Google Drive API v3          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Architectural Patterns

- **App Router Architecture:** Next.js 16 App Router where server-side routes live in `src/app/api/**/route.ts` and interactive dashboard views are client components in `src/app/**/page.tsx`.
- **Proxy-Based Request Interception (`src/proxy.ts`):** Follows the Next.js 16 conventions, handling public path bypasses (`/login`, `/api/auth/login`, `/api/webhooks/*`, `/sw.js`), JWT verification, role validation, and URL redirection prior to endpoint invocation.
- **Background Worker via Instrumentation (`src/instrumentation.ts`):** Automatically initializes continuous background scheduling (`restartNotificationLoop()`) when the Node.js runtime boots, eliminating the need for an external cron daemon for lead alerts and sheet syncing.
- **Multi-Adapter Database Factory (`src/lib/prisma.ts`):** Automatically detects database environment from `DATABASE_URL` and attaches the optimized Prisma driver adapter (Neon Serverless WebSocket driver vs. node-pg connection pooler with Supabase session/transaction pooler port translation).
- **Role-Based Access Control (RBAC) & Tenant Branch Filtering:**
  - `ADMIN`: Global visibility across all branches, consultants, platforms, and activity logs; user impersonation capability (`/api/auth/impersonate`).
  - `USER`: Scoped strictly by `assignedBranch` and `assignedPlatform`. Support for per-user lead hiding (`HiddenLead` model) and restricted external spreadsheet uploads (`allowExternalUpload`).
- **Idempotent Sheet Synchronization & Deduplication:**
  - Generates deterministic fingerprints from lead details (`src/lib/utils.ts` and `src/lib/sync.ts`) to avoid duplicate lead creation.
  - Maintains in-memory hashes of sheets and rows to avoid querying Google Sheets when data is unchanged.

## Component Boundaries

**API Endpoints (`src/app/api/`):**
- Location: `src/app/api/`
- Responsibilities: Validate request payloads, enforce session permissions, invoke business logic, and return standardized JSON responses.
- Dependencies: `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/activity.ts`, `src/lib/sync.ts`.

**Business Libraries (`src/lib/`):**
- Location: `src/lib/`
- Responsibilities: Isolate domain operations:
  - `activity.ts`: Persistent audit trail for lead actions.
  - `auth.ts` & `passwords.ts`: Scrypt hashing, JWT generation, session extraction.
  - `google.ts`: Google Sheets/Drive OAuth token refresh and spreadsheet communication.
  - `sync.ts` & `mapping.ts`: Transform external rows into `Lead` records and push status changes back.
  - `deduplicate.ts`: Detect and merge duplicate lead records.
  - `notifications.ts`: Web Push dispatch and alert scheduling.
- Dependencies: `@prisma/client`, `googleapis`, `web-push`, `jose`.

**Frontend Application Views (`src/app/`):**
- Location: `src/app/dashboard`, `src/app/activity`, `src/app/accounts`, `src/app/consultants`, `src/app/calendar`, `src/app/settings`, `src/app/login`
- Responsibilities: State management, real-time filtering, lead editing, inline consultant assignment, document export (PDF/Excel), and branch switching.
- Dependencies: `src/components/*`, `src/app/globals.css`.

**Reusable UI Components (`src/components/`):**
- Location: `src/components/`
- Responsibilities: Modular UI controls including navigation (`Sidebar.tsx`), consultant selector (`BranchConsultantPicker.tsx`), multi-select filtering (`MultiSelectDropdown.tsx`), external batch upload modal (`ExternalUploadModal.tsx`), and impersonation alert (`ImpersonationBanner.tsx`).

## Data Flow

**Lead Synchronization & Ingestion Flow:**
1. Background loop (`src/lib/notifications.ts`) or user trigger (`src/app/api/sheets/sync/route.ts`) requests sync.
2. `src/lib/google.ts` uses refreshed OAuth tokens to fetch rows from Google Sheets API v4.
3. `src/lib/sync.ts` applies column mappings from `Settings.columnMapping` and validates lead quality (`isLowQualityLead`).
4. Unique lead fingerprint is generated (`generateFingerprint`) and upserted into the `Lead` table via `src/lib/prisma.ts`.
5. Background alert dispatcher checks for newly uncontacted leads and dispatches Web Push notifications via `web-push`.

**Lead Action & Activity Trail Flow:**
1. Consultant or Admin updates lead status, remark, or assignment in `src/app/dashboard/page.tsx`.
2. Request posts to `src/app/api/leads/[id]/route.ts` or `/remark/route.ts`.
3. Handler updates database record and records action in `LeadActivity` via `logLeadActivity()` (`src/lib/activity.ts`).
4. If configured with Google Sheets sync, `src/lib/sync.ts` schedules or performs `batchUpdateSheetRows()` to mirror status updates back to the source Google Sheet.

## Critical Dependencies & Constraints

- **Next.js 16 App Router Conventions:** Next.js 16 uses Turbopack by default. `src/proxy.ts` acts as request interceptor.
- **Node.js Runtime Requirement for Background Worker:** `src/instrumentation.ts` requires `process.env.NEXT_RUNTIME === 'nodejs'` to run persistent intervals.
- **Database Connection Pooling:** Remote PostgreSQL connection string requires proper SSL parameters and pool size bounds (`max: 15` in `src/lib/prisma.ts`) to avoid database connection exhaustion.
- **Google OAuth Token Lifecycle:** Tokens must be refreshed periodically via `src/lib/google.ts`; refresh tokens are stored in the `Settings` database table.

## Anti-Patterns

### Monolithic Page Components

**What happens:** Pages like `src/app/dashboard/page.tsx` (2,700+ lines), `src/app/activity/page.tsx` (1,600+ lines), and `src/app/consultants/page.tsx` (1,600+ lines) contain complex state, rendering, and API logic in single large files.
**Why it's wrong:** High cognitive load, difficult maintainability, and increased risk of merge conflicts or unintended side-effects.
**Do this instead:** Extract specialized subcomponents (e.g., `LeadTable`, `LeadFilterBar`, `LeadDetailModal`) into modular files under `src/components/dashboard/`.

### Ad-Hoc Direct Database Updates Without Audit Logging

**What happens:** Modifying leads directly through ad-hoc Prisma queries without invoking `logLeadActivity`.
**Why it's wrong:** Breaks the compliance and traceability timeline displayed on the `/activity` dashboard.
**Do this instead:** Always route lead modifications through or pair them with `logLeadActivity()` from `src/lib/activity.ts`.

## Error Handling

**Strategy:** Defensive try/catch blocks in API routes and library wrappers, returning JSON errors with appropriate HTTP status codes (400, 401, 403, 404, 500).

**Patterns:**
- Uncaught API errors return `{ error: err.message || 'Internal server error' }` with HTTP 500.
- Database connection errors handled in `src/lib/prisma.ts` with pool warning listener.
- Non-blocking error handling in background worker (`src/lib/notifications.ts`) prevents daemon crashes from external API timeouts.

## Cross-Cutting Concerns

**Logging:** Console logging via standard `console.error` and `console.warn`. Lead operational audit logs persisted in `LeadActivity` database table.
**Validation:** Sanitization of strings via `sanitizeField` and phone number parsing via `parsePhoneNumber` in `src/lib/utils.ts`.
**Authentication:** HTTP-only session cookie (`sga-session`) verified by `jose` JWT library in `src/proxy.ts` and `src/lib/auth.ts`.

---

*Architecture analysis: 2026-09-11*
