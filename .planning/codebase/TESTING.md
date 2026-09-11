# Testing Patterns

**Analysis Date:** 2026-09-11

## Test Framework

**Runner:**
- None configured (No test runner currently installed in `package.json`)
- Config: None

**Assertion Library:**
- None configured

**Run Commands:**
```bash
npm run lint           # Static code analysis and type checking via ESLint 9
```

## Test File Organization

**Location:**
- Currently no automated unit, integration, or E2E tests exist in the project repository.
- Recommended future structure: Co-located tests next to modules (`src/lib/*.test.ts`) or dedicated `__tests__/` directories alongside route handlers (`src/app/api/**/__tests__/`).

**Naming:**
- Recommended standard: `*.test.ts` for unit/integration tests and `*.spec.ts` for browser/E2E tests.

**Structure:**
```
src/
├── lib/
│   ├── auth.ts
│   └── __tests__/
│       └── auth.test.ts
```

## Test Structure

**Suite Organization (Recommended for Vitest / Jest):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/passwords';

describe('passwords', () => {
  it('correctly hashes and verifies passwords using scrypt', () => {
    const password = 'securePassword123';
    const hash = hashPassword(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword('wrongPassword', hash)).toBe(false);
  });
});
```

**Patterns:**
- Setup pattern: Reset mocked timers and cached singletons in `beforeEach`
- Assertion pattern: Strict equality checks (`toBe`, `toEqual`) and rejection assertions for async error throwing

## Mocking

**Framework:**
- Recommended: `vitest` or `@jest/globals` with built-in mocking utilities.

**What to Mock:**
- External network requests: `googleapis` (Google Sheets and Drive API client)
- Push service delivery: `web-push` API calls in `src/lib/notifications.ts`
- Database transactions: Prisma client calls when testing pure business logic in `src/lib/sync.ts` or `src/lib/mapping.ts`

**What NOT to Mock:**
- Pure helper functions in `src/lib/utils.ts` (`parsePhoneNumber`, `sanitizeField`)
- Cryptographic verification logic in `src/lib/passwords.ts`
- Column mapping calculations in `src/lib/mapping.ts`

## Fixtures and Factories

**Test Data:**
- Synthetic lead objects representing Google Sheets raw rows:
  ```typescript
  const mockSheetRow = [
    'Rajesh Kumar',       // 0: Name
    '+91 9876543210',     // 1: Phone
    'Coimbatore',         // 2: City
    '2026-09-11',         // 3: Created At
    'Customer interested',// 4: Remark
    'Contacted',          // 5: Status
    'Harrier Campaign',   // 6: Ad Name
    'Coimbatore Central', // 7: Branch
  ];
  ```

**Location:**
- Recommended: `tests/fixtures/` or `src/lib/__fixtures__/`

## Coverage

**Requirements:**
- None currently enforced (0% automated coverage).

**View Coverage:**
- Not applicable until test framework is installed.

## Test Types

**Unit Tests:**
- Recommended priority for pure logic modules: `src/lib/passwords.ts`, `src/lib/utils.ts`, `src/lib/mapping.ts`, `src/lib/deduplicate.ts`.

**Integration Tests:**
- Recommended priority for API route handlers (`src/app/api/leads/route.ts`, `src/app/api/auth/login/route.ts`) using an ephemeral PostgreSQL database or SQLite adapter (`@prisma/adapter-better-sqlite3`).

**E2E Tests:**
- Not used / Not detected. Playwright is recommended for full lead lifecycle testing from login through lead editing and export.

## Common Patterns

**Async Testing Pattern:**
```typescript
it('handles sheet sync failure gracefully without crashing', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // await test execution
});
```

**Error Testing Pattern:**
```typescript
it('returns 401 when session cookie is absent', async () => {
  // test proxy / route response
});
```

---

*Testing analysis: 2026-09-11*
