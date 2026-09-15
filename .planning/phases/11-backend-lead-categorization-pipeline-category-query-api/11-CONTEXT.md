# Phase 11: Backend Lead Categorization Pipeline & Category Query API - Context

**Phase:** 11-backend-lead-categorization-pipeline-category-query-api
**Milestone:** v1.2
**Status:** In Progress

## Intent

Sales staff and dealership consultants need to easily segment leads into three clear operational queues:
1. **Priority Leads**: Inside Tamil Nadu (valid mapped branch) AND scheduled for follow-up today or overdue (`followUpDate1` or `followUpDate2` <= current IST end-of-day).
2. **Valid Leads**: All leads mapped inside Tamil Nadu (assigned to a dealership branch or valid TN location).
3. **Unassigned Leads**: Leads outside Tamil Nadu (out-of-state) or unresolved/unassigned (`branch` is empty, `null`, or `"Unassigned"`).

## Technical Strategy
- In `src/app/api/leads/route.ts`, parse `category = searchParams.get('category')`.
- Formulate Prisma `where` clause filters for each category.
- When computing `stats`, compute category counts (`priority`, `valid`, `unassigned`, `all`) in parallel queries using existing indexes (`@@index([branch])`).
- Return `categories` count dictionary inside `stats` response.
- Ensure seamless composability with search text, date ranges, consultant filters, and pagination.
