# Phase 11: Backend Lead Categorization Pipeline & Category Query API - Validation

**Phase:** 11-backend-lead-categorization-pipeline-category-query-api
**Milestone:** v1.2

## Acceptance Criteria

1. **Category Filtering (`GET /api/leads?category=...`)**:
   - `category=priority` returns only valid Tamil Nadu leads with follow-up date today or earlier (overdue).
   - `category=valid` returns all leads with assigned Tamil Nadu branch (`branch != ''` and `branch != 'Unassigned'`).
   - `category=unassigned` returns out-of-state and unassigned leads (`branch == ''` or `branch == 'Unassigned'`).
   - `category=all` or omitted returns all leads without category restriction.

2. **Stats Category Aggregation**:
   - When `skipStats` is false, `stats.categories` returns:
     - `priority`: count of priority leads.
     - `valid`: count of valid Tamil Nadu leads.
     - `unassigned`: count of unassigned / out-of-state leads.
     - `all`: total count.

3. **Timezone & Date Boundary Accuracy**:
   - Priority date evaluation uses Asia/Kolkata (IST) end-of-day (`23:59:59.999+05:30`).

4. **Integration & Automated Verification**:
   - Automated script tests querying each category and verifies returned data and counts.
   - `npx tsc --noEmit` exits with 0 errors.
