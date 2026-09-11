# Coding Conventions

**Analysis Date:** 2026-09-11

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `src/components/Sidebar.tsx`, `src/components/BranchConsultantPicker.tsx`)
- App route pages: Standard Next.js lowercase filenames (e.g., `src/app/dashboard/page.tsx`, `src/app/layout.tsx`)
- Route handlers: Standard Next.js route file naming (e.g., `src/app/api/leads/route.ts`)
- Library and utility modules: camelCase or kebab-case (e.g., `src/lib/activity.ts`, `src/lib/deduplicate.ts`)
- Configuration files: kebab-case or dot-notated (e.g., `eslint.config.mjs`, `next.config.ts`, `prisma.config.ts`)

**Functions:**
- Route methods: Uppercase HTTP verb matching Next.js App Router specification (e.g., `export async function GET(request: NextRequest)`, `POST`, `PUT`, `DELETE`)
- Helper functions: camelCase with action-oriented verbs (e.g., `parsePhoneNumber`, `sanitizeField`, `getCurrentUser`, `executeDeleteDuplicateLeads`)
- React components: PascalCase matching the component filename (e.g., `export function Sidebar()`, `export function BranchConsultantPicker(...)`)

**Variables:**
- Local variables and properties: camelCase (e.g., `currentUser`, `searchParams`, `primaryOrder`)
- Module-level constants: UPPER_SNAKE_CASE (e.g., `JWT_SECRET`, `COOKIE_NAME`, `SUB_CACHE_TTL_MS`, `DEFAULT_MAPPING`)

**Types and Interfaces:**
- Interfaces & Types: PascalCase (e.g., `UserSession`, `ColumnMapping`, `ExtendedPrismaClient`, `LeadSummary`)

## Code Style

**Formatting:**
- Indentation: 2 spaces
- Semicolons: Always used
- Quotes: Single quotes for TypeScript code, double quotes in JSON and JSX attributes
- CSS: Custom CSS properties (variables) defined at `:root` in `src/app/globals.css`, kebab-case class names (e.g., `.app-layout`, `.main-content`, `.btn-primary`)

**Linting:**
- Linter: ESLint 9 (`eslint.config.mjs`)
- Configs extended: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignored paths: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

## Import Organization

**Order:**
1. Node.js built-ins (`dns`, `crypto`, `fs`, `path`)
2. External framework and third-party libraries (`next/server`, `next/headers`, `@prisma/client`, `jose`, `googleapis`, `web-push`)
3. Internal aliases using `@/*` mapping:
   - `@/lib/*` (services, utilities, Prisma client)
   - `@/components/*` (UI components)
4. Stylesheet imports (`./globals.css`)

**Path Aliases:**
- Defined in `tsconfig.json`:
  ```json
  "paths": {
    "@/*": ["./src/*"]
  }
  ```
- Always use `@/lib/...` or `@/components/...` instead of deep relative imports (`../../lib/...`).

## Error Handling

**Patterns:**
- Route handlers wrap request processing in `try/catch` blocks:
  ```typescript
  try {
    // handler logic
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('API Error [leads]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
  ```
- Unauthorized access returns HTTP 401:
  ```typescript
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ```
- Forbidden / RBAC violations return HTTP 403:
  ```typescript
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  ```
- Resource not found returns HTTP 404:
  ```typescript
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
  ```

## Logging

**Framework:**
- Native console logging (`console.log`, `console.warn`, `console.error`)
- Structured lead audit logs saved to PostgreSQL via `logLeadActivity()` in `src/lib/activity.ts`

**Patterns:**
- Errors logged with contextual prefix: `console.error('Failed to sync sheet:', err)`
- Background job lifecycle events logged: `console.log('🔔 Notification loop started (every 15 minutes)')`

## Comments

**When to Comment:**
- Workarounds for platform-specific quirks (e.g., IPv4 DNS resolution for Supabase poolers in `src/lib/prisma.ts`)
- Algorithmic descriptions for complex deduplication or hash comparison logic in `src/lib/sync.ts`

**JSDoc/TSDoc:**
- Concise docstrings for exported utility helpers in `src/lib/passwords.ts` and `src/lib/utils.ts`

## Function Design

**Size:**
- Library helper functions in `src/lib/` are modular and concise (20–100 lines).
- Note: Some frontend page components (`dashboard/page.tsx`) have accumulated high complexity and require future decomposition.

**Parameters:**
- Destructured object options preferred for functions with >2 arguments:
  ```typescript
  export async function logLeadActivity({
    leadId,
    userId,
    username,
    action,
    oldValue,
    newValue,
  }: LogActivityParams)
  ```

**Return Values:**
- Explicit return types for library functions; standardized JSON payload `{ success: true, ... }` or `{ error: string }` for API responses.

## Module Design

**Exports:**
- Named exports preferred across modules:
  ```typescript
  export const prisma = ...;
  export function verifyPassword(...) { ... }
  ```
- Default exports reserved for Next.js App Router requirements (`export default function Page()`, `export default nextConfig`).

**Barrel Files:**
- Not used. Modules are directly imported from their specific file path (e.g., `@/lib/auth`, `@/lib/prisma`, `@/components/Sidebar`).

---

*Convention analysis: 2026-09-11*
