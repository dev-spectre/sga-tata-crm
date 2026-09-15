# Phase 7: Backend Lead Branch Update & Activity Audit Pipeline - Research

**Conducted:** 2026-09-15
**Status:** Complete

## Technical Findings

### 1. Database Schema & Branch Field
- In `prisma/schema.prisma`:
  ```prisma
  model Lead {
    id                 Int            @id @default(autoincrement())
    ...
    branch             String         @default("")
    assignedConsultant String?
    ...
  }
  ```
- `Lead.branch` is a non-null string defaulting to `""`.
- `Lead.assignedConsultant` is a nullable string (`String?`).
- Therefore, when setting branch to unassigned or empty, the DB representation should be `""`.
- When clearing consultant, the DB representation should be `null`.

### 2. Activity Diffing in `src/lib/activity.ts`
- `logLeadDiff` receives `previousLead` and `updates`.
- It iterates through modified fields to construct an array of `ActivityLogInput` objects.
- Crucially, line 51 of `src/lib/activity.ts` enforces:
  ```ts
  if (!user || isSuperAdminUser(user)) {
    return;
  }
  ```
  This guarantees that any action performed by a user where `isSuperAdminUser(user)` is true is completely dropped and never inserted into the `LeadActivity` table.
- Adding `updates.branch`:
  - Compare `previousLead.branch` and `updates.branch`.
  - If different, push `{ action: 'BRANCH_CHANGE', oldValue: oldBranch || 'Unassigned', newValue: newBranch || 'Unassigned' }`.

### 3. API Handler `PATCH /api/leads/[id]/route.ts`
- Current handler accepts:
  `const { status, remark, followUpDate1, followUpDate2, assignedConsultant, testDrive } = body;`
- Extracted fields are added to `updateData`.
- Adding:
  ```ts
  const { branch, clearConsultant } = body;
  if (branch !== undefined) {
    updateData.branch = typeof branch === 'string' ? branch.trim() : '';
  }
  if (clearConsultant === true) {
    updateData.assignedConsultant = null;
  }
  ```
- The handler calls `logLeadDiff({ leadId, user: currentUser, previousLead: lead, updates: updateData })`.
- Handles Google Sheets writeback for primary sheet leads:
  If `mapping.branch` is present, writes `updateData.branch`.
  If consultant was cleared and `mapping.assignedConsultant` is present, writes `""`.

### 4. Lock Handling
- `checkLeadLockForUser(leadId, currentUser)` ensures that if a lead is locked by a consultant/user, only that user or an admin can modify it.
- This adheres to existing access control policies.

## Validation Strategy
- Automated test script using Prisma client and mock/real sessions:
  1. Create a temporary test lead with `branch: "Coimbatore"`, `assignedConsultant: "Ramesh"`.
  2. Perform update as standard user: set `branch: "Salem"`, `clearConsultant: true`.
  3. Verify lead in DB has `branch: "Salem"`, `assignedConsultant: null`.
  4. Verify `LeadActivity` records contain `BRANCH_CHANGE` and `CONSULTANT_ASSIGN`.
  5. Perform update as Superadmin: set `branch: "Tirupur"`.
  6. Verify lead in DB has `branch: "Tirupur"`.
  7. Verify NO new `LeadActivity` records were created for Superadmin update.
  8. Clean up test lead.
