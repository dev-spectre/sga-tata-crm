# Phase 1: Branch Data Model & CRUD API - Research

**Analysis Date:** 2026-09-11
**Status:** Completed

<summary>
Investigated database schema expansion in Prisma 7 with PostgreSQL, dynamic adapter compatibility (`@prisma/adapter-neon` and `@prisma/adapter-pg`), dual-format REST endpoint design for Next.js 16 App Router, and role-based validation for branch management operations.
</summary>

<standard_stack>
## Standard Stack & Technologies

### Core Components
- **ORM:** Prisma 7.9.0 with `@prisma/client` (`prisma/schema.prisma`)
- **Database:** PostgreSQL (Neon Serverless / pg connection pooler)
- **API Runtime:** Next.js 16.2.12 Route Handlers (`src/app/api/branches/route.ts`, `src/app/api/branches/[id]/route.ts`)
- **Authentication:** `jose` JWT cookie session verified via `src/lib/auth.ts` (`getCurrentUser()`)
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Model Schema
```prisma
model Branch {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  code      String   @unique
  address   String   @default("")
  city      String   @default("")
  latitude  Float?
  longitude Float?
  radiusKm  Float    @default(50.0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
  @@index([code])
  @@index([city])
  @@index([isActive])
}
```

### Dual-Format API Route Response Pattern
To satisfy Decision `D-02`, `GET /api/branches` inspects the `format` search parameter:
```typescript
const format = request.nextUrl.searchParams.get('format');
const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';

const branches = await prisma.branch.findMany({
  where: includeInactive ? {} : { isActive: true },
  orderBy: { name: 'asc' },
});

if (format === 'names') {
  return NextResponse.json({ branches: branches.map(b => b.name) });
}

return NextResponse.json({
  branches,
  branchNames: branches.map(b => b.name),
});
```
This guarantees that existing components expecting `{ branches: string[] }` receive the exact string list while the new `/branches` management UI receives full branch objects with coordinates.

### Soft-Delete & Deactivation Pattern
```typescript
// Soft-delete toggle in DELETE /api/branches/[id]
await prisma.branch.update({
  where: { id: branchId },
  data: { isActive: false },
});
```
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Branch Persistence | Custom SQL table creation | Prisma schema + migration | Preserves type safety and client sync |
| Auth Verification | Ad-hoc header/cookie check | `getCurrentUser()` in `src/lib/auth.ts` | Centralizes JWT parsing and role check |
| Coordinate Storage | String comma-separated coords | Distinct Float columns (`latitude`, `longitude`) | Enables indexing and fast Haversine math |
| Legacy Dropdown Support | Duplicated separate API routes | Single endpoint with `?format=names` query param | Prevents drift between branch lists |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Breaking Existing Legacy Branch Dropdowns
**What goes wrong:** Changing `GET /api/branches` to return `Branch[]` breaks components like `BranchConsultantPicker.tsx` that do `branches.map(b => <option key={b} value={b}>{b}</option>)`.
**How to avoid:** Return dual keys `{ branches: Branch[], branchNames: string[] }` by default or return string array when `?format=names` is requested, and make sure `branchNames` exists for safety.

### Pitfall 2: Foreign Key Collisions on Branch Deletion
**What goes wrong:** Hard deleting a branch causes orphaned leads or crashes queries if leads reference the deleted branch name.
**How to avoid:** Enforce soft-delete only (`isActive = false`). Exclude inactive branches from lead routing dropdowns while keeping historical records intact.

### Pitfall 3: Database Migration Drift
**What goes wrong:** Running `prisma migrate dev` when migrations are out of sync with a live Neon/Supabase instance.
**How to avoid:** Verify database connection with `npx prisma migrate dev --name add_branch_model` or check migration status before applying.
</common_pitfalls>

<code_examples>
## Code Examples

### POST /api/branches Validation
```typescript
const body = await request.json();
const { name, code, address = '', city = '', latitude, longitude, radiusKm = 50 } = body;

if (!name?.trim() || !code?.trim()) {
  return NextResponse.json({ error: 'Branch name and code are required' }, { status: 400 });
}

const existing = await prisma.branch.findFirst({
  where: { OR: [{ name: name.trim() }, { code: code.trim().toUpperCase() }] },
});

if (existing) {
  return NextResponse.json({ error: 'Branch name or code already exists' }, { status: 409 });
}

const branch = await prisma.branch.create({
  data: {
    name: name.trim(),
    code: code.trim().toUpperCase(),
    address: address.trim(),
    city: city.trim(),
    latitude: latitude !== undefined && latitude !== null && !isNaN(Number(latitude)) ? Number(latitude) : null,
    longitude: longitude !== undefined && longitude !== null && !isNaN(Number(longitude)) ? Number(longitude) : null,
    radiusKm: Number(radiusKm) || 50,
    isActive: true,
  },
});
```
</code_examples>

## Validation Architecture

### Automated Verification
1. `npx prisma validate` — Verifies Prisma schema syntax.
2. `npx prisma generate` — Verifies TypeScript client generation for `prisma.branch`.
3. `npm run lint` — Verifies no TypeScript or ESLint regressions across route handlers.

### Manual Verification Flow
1. Create a branch via `POST /api/branches` with `name`, `code`, `address`, `city`, `latitude`, `longitude`.
2. Fetch via `GET /api/branches` and confirm full object returns.
3. Fetch via `GET /api/branches?format=names` and confirm `string[]` returns for legacy pickers.
4. Update branch via `PUT /api/branches/[id]`.
5. Soft-delete branch via `DELETE /api/branches/[id]` and verify `isActive` is set to `false`.

---

*Phase: 01-branch-data-model-crud-api*
*Research completed: 2026-09-11*
*Ready for planning: yes*
