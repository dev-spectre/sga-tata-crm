# External Integrations

**Analysis Date:** 2026-09-11

## APIs & External Services

**Google Cloud Services:**
- Google Sheets API v4 - Bi-directional lead syncing, reading rows, appending new leads, and batch updating statuses
  - SDK/Client: `googleapis` (v173.0.0 via `google.sheets('v4')` in `src/lib/google.ts`)
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` with OAuth2 refresh tokens stored in database `Settings` model
- Google Drive API v3 - File search and sheet selection for lead data sources
  - SDK/Client: `googleapis` (v173.0.0 via `google.drive('v3')` in `src/lib/google.ts`)
  - Auth: Shared Google OAuth2 client credentials

**Web Push Notifications:**
- Browser Push Notification Service (RFC 8291 / 8292 standard)
  - SDK/Client: `web-push` (v3.6.7 in `src/lib/notifications.ts`, Service Worker in `public/sw.js`)
  - Auth: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - Subscription endpoint: `/api/push/subscribe` managing records in `PushSubscription` model

## Data Storage

**Databases:**
- PostgreSQL (Neon Serverless or Standard PostgreSQL / Supabase)
  - Connection: `DATABASE_URL`
  - Client: Prisma ORM (`@prisma/client`) configured with dynamic adapters in `src/lib/prisma.ts`:
    - `PrismaNeon` (`@prisma/adapter-neon`) activated for `neon.tech` endpoints
    - `PrismaPg` (`@prisma/adapter-pg` with `pg.Pool`) for standard PostgreSQL connections, with automatic port rewrites (5432 to 6543) for Supabase transaction poolers to mitigate `EMAXCONNSESSION` errors

**File Storage:**
- Local in-memory generation only (`jspdf`, `jspdf-autotable`, `xlsx`)
- Direct client-side browser downloads for exported data; no external cloud blob storage (S3/GCS) configured

**Caching:**
- In-memory cache layers:
  - Settings cache: `src/lib/settings.ts` (`getCachedSettings`, `invalidateSettingsCache`)
  - Push subscription cache: `src/lib/notifications.ts` (`getCachedPushSubscriptions`, 60-second TTL)
  - Google Sheet row and sheet content hashes: `src/lib/sync.ts` (`cachedSheetHash`, `cachedRowHashes` Map) to minimize duplicate sync queries
  - Lead existence check caching: `src/app/api/leads/check/route.ts`

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based session authentication
  - Implementation: `jose` (`SignJWT`, `jwtVerify`) in `src/lib/auth.ts` and request routing proxy in `src/proxy.ts`
  - Password hashing: Cryptographic `scrypt` using 16-byte random salt and constant-time `timingSafeEqual` comparisons in `src/lib/passwords.ts`
  - Session cookie: `sga-session` (HTTP-only secure cookie)
  - Access control: Multi-role support (`ADMIN`, `USER`), branch-level and platform-level isolation, and admin user impersonation (`/api/auth/impersonate`)

## Monitoring & Observability

**Error Tracking:**
- Not integrated (no external APM or error reporting service like Sentry or Datadog)
- Native standard stream logging: `console.error`, `console.warn`, `console.log`

**Logs & Auditing:**
- Comprehensive persistent audit log stored in database via `LeadActivity` model and managed by `src/lib/activity.ts`
- Records user actions: lead creation, assignment changes, remark updates, status transitions, deletions, and external batch uploads

## CI/CD & Deployment

**Hosting:**
- Node.js server environment / Vercel deployment (`@vercel/functions` included)

**CI Pipeline:**
- Not detected (no automated CI/CD pipeline configuration files present)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Cryptographic key for session token signing and verification
- `ADMIN_USERNAME` - Initial administrative account username
- `ADMIN_PASSWORD` - Initial administrative account password
- `GOOGLE_CLIENT_ID` - Google OAuth2 client application ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth2 client application secret
- `GOOGLE_REDIRECT_URI` - Google OAuth2 callback endpoint URI
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Public key for client-side push notification subscription
- `VAPID_PRIVATE_KEY` - Private key for server-side push message signing
- `VAPID_SUBJECT` - Contact email URI for VAPID service identification

**Secrets location:**
- Local environment files (`.env`, `.env.production`) or platform secret manager in production

## Webhooks & Callbacks

**Incoming:**
- `src/app/api/webhooks/sheets/route.ts` - Inbound webhook for Google Sheets trigger scripts
- `src/app/api/webhooks/lead/route.ts` - External API endpoint for programmatic lead intake
- `src/app/api/auth/google/callback/route.ts` - OAuth2 redirect handler receiving tokens from Google authentication servers

**Outgoing:**
- Outbound Web Push payloads to Push Service endpoints stored in `PushSubscription` model

---

*Integration audit: 2026-09-11*
