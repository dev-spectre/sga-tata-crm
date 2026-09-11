# Codebase Structure

**Analysis Date:** 2026-09-11

## Directory Layout

```
sga-tata-crm/
├── prisma/                     # Database schema and migration definitions
│   ├── migrations/             # Timestamped SQL migration history
│   └── schema.prisma           # Prisma data models and datasource configuration
├── public/                     # Static assets served by Next.js
│   ├── logo.jpg                # Brand identity logo
│   └── sw.js                   # Service Worker for browser Web Push notifications
├── src/                        # Main application source code
│   ├── app/                    # Next.js App Router pages and API routes
│   │   ├── (views)/            # Page routes: accounts, activity, calendar, consultants, dashboard, login, settings
│   │   ├── api/                # Backend API route handlers (RESTful JSON endpoints)
│   │   ├── globals.css         # Global stylesheet, design system tokens, CSS variables
│   │   ├── layout.tsx          # Root layout shell with Sidebar, Banner, and NotificationInit
│   │   └── page.tsx            # Root redirection entry point
│   ├── components/             # Reusable React client components
│   ├── lib/                    # Core business logic, Prisma client, Google APIs, and utility modules
│   ├── instrumentation.ts      # Next.js server startup hook for background worker loops
│   └── proxy.ts                # Next.js 16 request interceptor and session guard
├── .env.example                # Sample environment variables template
├── eslint.config.mjs           # Flat ESLint 9 configuration
├── next.config.ts              # Next.js framework configuration and redirects
├── package.json                # Project dependencies and npm lifecycle scripts
├── prisma.config.ts            # Prisma 7 project configuration
└── tsconfig.json               # TypeScript compiler configuration with @/* alias
```

## Directory Purposes

**`src/app/`:**
- Purpose: Defines all web application views and backend API routes using Next.js App Router conventions.
- Contains: React components (`page.tsx`), Next.js layouts (`layout.tsx`), API route handlers (`route.ts`), and global styles (`globals.css`).
- Key files: `src/app/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/globals.css`.

**`src/app/api/`:**
- Purpose: Backend REST API endpoints serving frontend client views and external webhooks.
- Contains: Subdirectories for each resource: `admin/`, `auth/`, `branches/`, `consultants/`, `leads/`, `notifications/`, `platforms/`, `push/`, `settings/`, `sheets/`, `users/`, `webhooks/`.
- Key files: `src/app/api/leads/route.ts`, `src/app/api/sheets/sync/route.ts`, `src/app/api/auth/login/route.ts`.

**`src/components/`:**
- Purpose: UI components shared across multiple pages.
- Contains: React client components (`.tsx`).
- Key files: `src/components/Sidebar.tsx`, `src/components/BranchConsultantPicker.tsx`, `src/components/MultiSelectDropdown.tsx`, `src/components/ExternalUploadModal.tsx`, `src/components/ImpersonationBanner.tsx`, `src/components/NotificationInit.tsx`.

**`src/lib/`:**
- Purpose: Domain business logic, third-party service clients, and backend utilities.
- Contains: Standalone TypeScript modules (`.ts`).
- Key files: `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/google.ts`, `src/lib/sync.ts`, `src/lib/activity.ts`, `src/lib/notifications.ts`, `src/lib/passwords.ts`, `src/lib/deduplicate.ts`, `src/lib/mapping.ts`, `src/lib/utils.ts`.

**`prisma/`:**
- Purpose: Data schema definition and database migration history.
- Contains: `schema.prisma` and SQL migration folders.
- Key files: `prisma/schema.prisma`.

**`public/`:**
- Purpose: Static assets and service worker script served at root URL.
- Contains: Images and client-side background service worker.
- Key files: `public/sw.js`, `public/logo.jpg`.

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Initial landing page (redirects authenticated users to `/dashboard` or unauthenticated to `/login`).
- `src/proxy.ts`: Edge/middleware-equivalent proxy intercepting incoming HTTP requests, managing auth redirects and session validation.
- `src/instrumentation.ts`: Server initialization hook that boots the background notification loop when running in Node.js.

**Configuration:**
- `next.config.ts`: Next.js server configuration and URL rewrite rules.
- `tsconfig.json`: TypeScript configuration, strict options, path aliases.
- `prisma.config.ts`: Prisma 7 configuration file.
- `eslint.config.mjs`: ESLint flat configuration.

**Core Logic:**
- `src/lib/prisma.ts`: Prisma Client factory with dynamic Neon vs PostgreSQL pooler adapter handling.
- `src/lib/sync.ts`: Google Sheets sync engine, row mapping, and lead deduplication trigger.
- `src/lib/google.ts`: Google OAuth2 and Sheets/Drive API integrations.
- `src/lib/auth.ts`: JWT session token signing and verification, default admin initialization.
- `src/lib/notifications.ts`: Web Push notification dispatcher and background polling loop.

**Testing:**
- Not configured / Not detected (no test files or test runner setup in current codebase).

## Naming Conventions

**Files:**
- Page routes: Standard Next.js `page.tsx`, `layout.tsx`, `route.ts`.
- Components: PascalCase for React components, e.g., `src/components/BranchConsultantPicker.tsx`.
- Library modules: camelCase or kebab-case for utilities, e.g., `src/lib/prisma.ts`, `src/lib/deduplicate.ts`.

**Directories:**
- App routes: kebab-case or lower-case, e.g., `src/app/api/admin/activity/handled-leads/`.
- Dynamic parameters in route paths: Bracketed syntax, e.g., `src/app/api/leads/[id]/`.

## Where to Add New Code

**New Feature View:**
- Primary code: Create new directory in `src/app/<feature-name>/page.tsx`.
- Sidebar navigation: Update `src/components/Sidebar.tsx` to add the new route link.
- Tests: Add corresponding test files alongside the feature once test runner is configured.

**New API Endpoint:**
- Primary code: Create `src/app/api/<resource>/route.ts` or `src/app/api/<resource>/[id]/route.ts`.
- Business logic: Encapsulate reusable domain logic in a module under `src/lib/`.

**New Shared Component:**
- Implementation: `src/components/<ComponentName>.tsx`.

**New Database Model:**
- Implementation: Add model to `prisma/schema.prisma`, then run `npx prisma migrate dev --name <migration_name>` and `npx prisma generate`.

**Shared Utilities:**
- Implementation: Add helper function to `src/lib/utils.ts` or dedicated module under `src/lib/`.

## Special Directories

**`prisma/migrations/`:**
- Purpose: Tracks versioned SQL migrations generated by Prisma.
- Generated: Yes (via `prisma migrate`).
- Committed: Yes.

**`.next/`:**
- Purpose: Build outputs and dev caches produced by Next.js/Turbopack.
- Generated: Yes.
- Committed: No (in `.gitignore`).

**`node_modules/`:**
- Purpose: Third-party dependencies installed via npm.
- Generated: Yes.
- Committed: No (in `.gitignore`).

---

*Structure analysis: 2026-09-11*
