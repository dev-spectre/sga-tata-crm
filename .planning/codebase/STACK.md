# Technology Stack

**Analysis Date:** 2026-09-11

## Languages

**Primary:**
- TypeScript 5.x - Entire application logic (`src/**/*.ts`, `src/**/*.tsx`, `prisma.config.ts`, `next.config.ts`)

**Secondary:**
- JavaScript / ESM - Config files and Service Worker (`eslint.config.mjs`, `public/sw.js`)
- CSS - Styling via CSS variables and Glassmorphism system (`src/app/globals.css`)
- SQL / Prisma Schema - Data models and database migrations (`prisma/schema.prisma`, `prisma/migrations/*`)

## Runtime

**Environment:**
- Node.js (v20+ via `@types/node: ^20`)
- Next.js 16.2.12 (Turbopack bundler for development and build)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.2.12 - Full-stack React framework utilizing the App Router architecture (`src/app/`)
- React 19.2.4 & React DOM 19.2.4 - Frontend component rendering library

**Testing:**
- Not installed / Not detected (no testing framework or runner present in `package.json`)

**Build/Dev:**
- Turbopack (via `next dev`) - High-performance dev server and bundler
- TypeScript 5.x (`tsconfig.json`) - Strict type checking and module resolution
- ESLint 9 (`eslint.config.mjs`) - Flat configuration using `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Prisma CLI 7.9.0 - Schema management, migrations, and type-safe client generation

## Key Dependencies

**Critical:**
- `@prisma/client` (7.9.0) & `prisma` (7.9.0) - ORM for data modeling and query building
- `@prisma/adapter-neon` (7.9.1) & `@neondatabase/serverless` (1.1.0) - Serverless WebSocket/HTTP adapter for Neon PostgreSQL databases
- `@prisma/adapter-pg` (7.9.1) & `pg` (8.22.0) - Standard connection pooler adapter for PostgreSQL
- `jose` (6.2.4) - Edge-compatible JWT signing and verification for session management
- `googleapis` (173.0.0) - Official Google APIs client for Google Sheets and Google Drive integration
- `web-push` (3.6.7) - Web Push protocol library handling RFC 8291 / 8292 encrypted payloads with VAPID keys

**Infrastructure:**
- `better-sqlite3` (13.0.3) & `@prisma/adapter-better-sqlite3` (7.9.1) - SQLite driver support
- `dotenv` (17.4.2) - Environment configuration loading for CLI and Prisma scripts
- `jspdf` (4.2.1) & `jspdf-autotable` (5.0.8) - PDF document generation for lead summaries and analytics
- `xlsx` (0.18.5) - Spreadsheet parser and generator for manual lead imports and exports

## Configuration

**Environment:**
- Managed via `.env` (development) and `.env.production` (production)
- Template documented in `.env.example`
- Critical variables: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

**Build:**
- `next.config.ts` - Next.js configuration including path redirects (`/consultant` -> `/consultants`)
- `tsconfig.json` - Target ES2017, bundler module resolution, `@/*` path alias mapping to `./src/*`
- `eslint.config.mjs` - ESLint flat config with global ignores for build artifacts
- `prisma.config.ts` - Prisma 7 configuration file pointing to `prisma/schema.prisma` and `prisma/migrations`

## Platform Requirements

**Development:**
- Node.js 20+, npm, access to PostgreSQL instance (Neon, Supabase pooler, or local)
- Background loop automatically started via `src/instrumentation.ts` when running in Node.js runtime

**Production:**
- Node.js compatible environment supporting persistent background timers or serverless triggers with PostgreSQL connection pooling

---

*Stack analysis: 2026-09-11*
