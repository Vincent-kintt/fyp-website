# Phase A: Dead Code Cleanup

**Date:** 2026-03-31
**Goal:** Remove all dead code, orphaned files, and unused exports so every line in the codebase is actively used. This clears noise before Phase B (pattern unification).

## Scope

This phase performs deletions and trivial fixes only. No logic changes, no refactoring, no new abstractions.

## 1. Delete Orphaned Files

| File | Reason |
|------|--------|
| `lib/auth.js` | Zero imports. Credential verification logic duplicated inline in `auth.js` (NextAuth config). |
| `components/ui/Skeleton.js` | Zero imports. All skeleton UIs are inlined in their respective pages. |
| `components/reminders/AgentStepIndicator.js` | Zero imports. Legacy multi-agent UI component, superseded by `AgentActivityLog`/`ToolResultCard`. |
| `components/reminders/AgentThinkingIndicator.js` | Zero imports. Same as above. |

## 2. Clean `lib/utils.js` Dead Exports

Remove the following exports that have zero production imports:

- `formatDate` — each consumer defines its own local version
- `formatDateTime` — never imported
- `isOverdue` — consumers use `isPast()` from date-fns instead
- `getCategoryColor` — duplicated locally in DayTimeline.js and ReminderCard.js (dedup is Phase B)
- `getCategoryIndicatorColor` — never imported
- `validateReminder` — never imported
- `generateId` — never imported
- `validateTag` — only used in tests
- `getTagColor` — only used internally by `getTagClasses`; inline it into `getTagClasses`
- `categoryToTag` — only used in tests
- `ensureCategoryTag` — only used in tests
- `STATUS_TRANSITIONS` — only used in tests and internally by `isValidTransition`
- `STATUS_CONFIG` — never imported in production; `ToolResultCard.js` defines its own with different shape
- `getPriorityCheckboxColor` — never imported
- `getStatusClasses` — never imported; consumers use `getStatusConfig()` directly

Keep all exports that have active production imports untouched.

## 3. Fix Miscellaneous Issues

### Unused imports in `app/api/reminders/route.js`
Remove `isValidStatus` and `formatDuration` from the import statement (imported but never used in the file body).

### Broken links in `app/page.js`
Lines 31 and 92: change `href="/reminders/new"` to `href="/login"`. The `/reminders/new` route does not exist. This landing page is only visible to unauthenticated users (authenticated users are redirected to `/dashboard`), so `/login` is the correct target.

### CJS require in ESM project — `auth.js`
Change `const bcrypt = require("bcryptjs")` to `import bcrypt from "bcryptjs"` for consistency with the rest of the codebase (`"type": "module"` in package.json).

## 4. Clean Tests

In `tests/utils.test.js`, remove test cases that test deleted functions. Keep test cases for functions that remain exported.

## 5. Verification

- `npm run build` — must pass with zero errors
- `npm test` — remaining tests must pass
- Manual check: no import errors, no broken references

## Out of Scope

- Consolidating duplicate patterns (getCategoryColor, formatDate, priorityConfig, fetchTasks) — Phase B
- Splitting large files (AIReminderModal, dashboard) — Phase C
- Any logic changes or new abstractions
