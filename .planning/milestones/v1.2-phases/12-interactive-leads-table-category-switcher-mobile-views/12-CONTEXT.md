# Phase 12: Interactive Leads Table Category Switcher & Mobile Views - Context

**Phase:** 12-interactive-leads-table-category-switcher-mobile-views
**Milestone:** v1.2
**Status:** In Progress

## Intent

Sales staff need a fast, visual, and one-click interface to switch between three core lead operational categories:
1. **Priority (Follow-up Today)**: Tamil Nadu leads that need action right now.
2. **Valid (Tamil Nadu)**: All valid dealership leads inside Tamil Nadu.
3. **Unassigned (Out of State)**: Leads outside Tamil Nadu or unassigned.
4. **All Leads**: Unfiltered lead overview.

## Design & UI Specifications
- Render a premium segmented control / category tab switcher directly above the leads table (and in mobile view).
- Each tab contains:
  - An icon/indicator (e.g. Flame/Alert for Priority, Check/Map for Valid, Alert/Globe for Unassigned, Stack for All).
  - Label: "Priority (Today)", "Valid (TN)", "Unassigned", "All Leads".
  - Live badge counter reflecting `categoryCounts` from `stats.categories`.
- Clicking a tab:
  - Sets `category` state (`priority`, `valid`, `unassigned`, `all`).
  - Resets pagination to page 1.
  - Updates URL query parameter `?category=...`.
  - Persists preference in `localStorage`.
- Mobile responsiveness: Tab bar scrolls horizontally or flex-wraps neatly with tap-friendly pill buttons without breaking layout.
- Styling conforms to rich design aesthetic guidelines: sleek dark mode compatibility, crisp badges, smooth transitions.

## Affected Files
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`
