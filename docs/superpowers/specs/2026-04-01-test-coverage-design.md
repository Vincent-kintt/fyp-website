# Test Coverage Design — Risk-Based Strategy

**Date**: 2026-04-01
**Status**: Approved (post-review)
**Approach**: Risk-Based (Approach C) — prioritize by impact and bug probability

## Overview

Increase test coverage from 84 tests (2 files) to ~182 tests across 4 layers:
API route integration tests → E2E critical paths → Unit tests for untested libs → Coverage reporting.

Component tests are intentionally excluded (high mock cost for Next.js context/React Query/dnd-kit, low ROI — E2E covers component behavior implicitly).

## New Dependencies

- `@playwright/test` (devDependency) — E2E framework
- `@vitest/coverage-v8` (devDependency) — coverage reporting

## Layer 1: API Route Integration Tests (~50 tests)

### Approach

Import route handler functions directly (GET, POST, PATCH, DELETE), pass Request objects,
mock `auth()` from `@/auth` and `getCollection()` from `@/lib/db` via MongoMemoryServer.

This tests actual handler logic (auth guards, validation, DB queries, response shapes)
without needing an HTTP server. Next.js middleware is NOT tested at this layer (acceptable —
middleware only does route protection, which is also guarded per-handler).

### Shared Helpers

**`tests/helpers/db.js`** — Extracted from `tests/ai-tools.test.js`:
- `startDb()` — creates MongoMemoryServer, connects client, returns `{ db, client, mongod }`
- `stopDb({ client, mongod })` — closes client, stops server
- `clearDb(db)` — drops all collections (for `beforeEach`)

**`tests/helpers/api.js`**:
- `mockSession(user)` — sets `auth()` mock to return `{ user }` or `null`
- `createRequest(method, url, { body, searchParams })` — builds Request with full URL + query string
- `params(obj)` — returns `{ params: Promise.resolve(obj) }` (Next.js 15 async params)
- `parseResponse(response)` — `{ status, data: await response.json() }` shorthand

### Validation: Proof of Concept First

Before writing all tests, validate the handler import pattern with ONE route (`GET /api/reminders`).
Verify that `NextResponse.json()` works outside Next.js runtime. If it fails, fall back to
supertest with a minimal HTTP server wrapper.

### Vitest Configuration

- `--pool=forks --poolOptions.forks.singleFork` to prevent multiple MongoMemoryServer instances
- After helpers are solid, can explore parallel execution with unique ports per file

### Environment Mocking

- `vi.stubEnv('CRON_SECRET', 'test-secret')` for cron route tests
- `vi.useFakeTimers()` for all date-dependent tests (cron, snooze, unsnooze)

### Test Files

#### `tests/integration/reminders-api.test.js` (~14 tests)

GET /api/reminders:
- Unauthenticated → 401
- Returns all reminders for the user
- Filters by `category` param
- Filters by `tag` param
- Combined `category` + `tag` filter (tests $and/$or merge path)
- Filters by `type=recurring`
- User isolation — cannot see other user's reminders

POST /api/reminders:
- Unauthenticated → 401
- Missing required fields (title, dateTime) → 400
- Happy path → 201 + formatted reminder with all defaults
- Tags are normalized
- Invalid duration → 400
- Field length validation (title > 200 chars) → 400
- Verify defaults: `completed: false`, `status: "pending"`, `sortOrder: 0`, `notificationSent: false`

#### `tests/integration/reminder-id-api.test.js` (~24 tests)

GET /api/reminders/[id]:
- Unauthenticated → 401
- Invalid ObjectId → 400
- Not found → 404
- Other user's reminder → 404 (user isolation)
- Happy path → formatted reminder

PUT /api/reminders/[id]:
- Unauthenticated → 401
- Missing required fields → 400
- Valid status transition (pending → completed)
- Invalid status transition (completed → snoozed) → 400
- Not found during transition check → 404
- Field length validation → 400

DELETE /api/reminders/[id]:
- Unauthenticated → 401
- Happy path → stripped-down response shape (no status/subtasks/sortOrder)
- Other user's reminder → 404
- Invalid ObjectId → 400

PATCH /api/reminders/[id]:
- Unauthenticated → 401
- Status transition pending → completed (sets `completedAt`)
- Status transition pending → in_progress (sets `startedAt`)
- Invalid status transition → 400
- Snooze requires `snoozedUntil` → 400
- Happy snooze (sets `snoozedUntil`)
- Leaving snoozed clears `snoozedUntil`
- Backward-compat: `completed: true` boolean (derives status)
- Backward-compat: `completed: false` boolean
- Partial update (title, tags, priority only)
- `dateTime` update resets `notificationSent`
- Invalid duration → 400
- Field length validation → 400
- Not found → 404
- User isolation

#### `tests/integration/reorder-api.test.js` (~8 tests)

- Unauthenticated → 401
- Empty items array → 400
- Invalid ID in items → 400
- sortOrder not a number → 400
- Happy path — verify sortOrder updated in DB
- Items with optional `dateTime` — verify `notificationSent` reset
- User isolation — cannot reorder other user's reminders
- Multiple items batch reorder

#### `tests/integration/cron-api.test.js` (~12 tests)

notify:
- Missing CRON_SECRET → 401
- Wrong CRON_SECRET → 401
- CRON_SECRET env unset (falsy) → 401
- Happy path — marks `notificationSent: true`, returns counts
- No matching push subscriptions — silent skip
- Expired subscription (410/404) — cleanup + count
- Failed push — increments failed count

unsnooze:
- Missing CRON_SECRET → 401
- Expired snoozed reminders → status changed to pending, `completed: false`
- Non-expired snoozed reminders — unaffected

cleanup-subscriptions:
- Missing CRON_SECRET → 401
- Deletes subscriptions older than threshold

Mock: `vi.mock('@/lib/push')` for `sendPushNotification` — must be registered BEFORE route import.

## Layer 2: E2E Tests (~15 test cases)

### Setup

**`playwright.config.js`**:
- `webServer`: `npm run dev` (local), `npm run build && npm run start` (CI via env var)
- `webServer.timeout`: 30000ms (Turbopack cold start)
- `reuseExistingServer: true`
- `retries: 1` for flaky tolerance
- `screenshot: 'only-on-failure'`
- `trace: 'on-first-retry'`
- Output dir: `.playwright-mcp/screenshots/`

**`e2e/auth.setup.js`**:
- Navigate to `/login`
- Fill `input[name="username"]` + `input[name="password"]` with seed user credentials
- Click submit
- `await page.waitForURL('/dashboard')` — critical: ensures JWT cookie is set
- Save `storageState` to `.playwright-auth/user.json`

**Per-spec DB seeding**:
- Each spec seeds its own test data via `POST /api/reminders` in `beforeAll`
- Cleanup via `DELETE /api/reminders/[id]` in `afterAll`
- Tests are independently runnable in any order

### Prerequisite: Add `data-testid` Attributes (~30 min)

Before writing any E2E test, add these to source components:
- `data-testid="login-form"` — login page form
- `data-testid="navbar-username"` — Navbar username display
- `data-testid="quick-add-trigger"` — QuickAdd collapsed button
- `data-testid="quick-add-input"` — QuickAdd expanded input
- `data-testid="task-item-{id}"` — each TaskItem
- `data-testid="task-section-{sectionId}"` — each TaskSection
- `data-testid="global-search-input"` — cmdk search input
- `data-testid="calendar-cell-{date}"` — calendar date cells
- `data-testid="ai-modal-input"` — AI chat input

### Test Specs

#### `e2e/login.spec.js` (~3 tests)
- Valid credentials → redirect to dashboard + navbar shows username
- Invalid credentials → error message displayed
- Unauthenticated access to /dashboard → redirect to /login

#### `e2e/task-crud.spec.js` (~4 tests)
- QuickAdd: type task → submit → appears in task list
- Edit: click task → side panel opens → modify title → save → title updated
- Complete: toggle checkbox → task moves to Completed section
- Delete: delete task → undo toast appears → task removed after timeout

#### `e2e/search.spec.js` (~3 tests)
- Cmd+K opens search modal
- Type keyword → matching results appear
- Click result → navigates to correct page

#### `e2e/calendar.spec.js` (~3 tests)
- Navigate to /calendar → month view renders
- Click date → DayTimeline shows tasks for that date
- Task dots visible on dates with tasks

#### `e2e/ai-modal.spec.js` (~2 tests)
- Open AI modal (Cmd+J or FAB) → modal visible
- Send a simple message → response streams back

### Stretch Goal (NOT in initial scope)

#### `e2e/dashboard-dnd.spec.js`
- Within-section reorder in Today
- Demoted due to @dnd-kit PointerSensor + Playwright synthetic event incompatibility risk
- DnD logic is covered by unit tests on `lib/dnd.js` pure functions instead

## Layer 3: Unit Tests (~25 tests)

#### `tests/unit/reminderUtils.test.js` (~12 tests)
- `formatReminder`: full field mapping, missing field defaults, `_id` → `id`, status derived from `completed`
- `normalizeSubtasks`: string array, object array, `preserveIds: true/false`, `batchIndex`, non-array → []
- `apiSuccess`: returns `{ success: true, data }` with correct status
- `apiError`: returns `{ success: false, error }` with correct status
- `validateReminderFields`: title > 200, description > 5000, remark > 2000, tags > 20 or tag > 50

#### `tests/unit/format.test.js` (~8 tests)
- `formatDateCompact`: null → "No date", epoch → "No date", valid date, zh locale
- `formatDateShort`: valid date format, invalid date → ""
- `formatDateMedium`: correct format string
- `formatDateFull`: correct format string

#### `tests/unit/dnd.test.js` (~5 tests)
- `computeNewDateTime`: preserves original time when changing date
- `computeSortOrders`: correct 1000-increment spacing
- `getSectionForDate`: correct section assignment (overdue/today/tomorrow/this_week)
- `isDropAllowed`: blocks drag TO Overdue, blocks COMPLETED↔SNOOZED direct
- Note: `createSectionAwareCollision` requires DOM, cannot unit test — covered by E2E stretch goal

## Layer 4: Coverage Reporting

- Install `@vitest/coverage-v8`
- New script: `"test:coverage": "vitest run --coverage"`
- Config in `vitest.config.js`:
  ```js
  coverage: {
    provider: 'v8',
    include: ['lib/**', 'app/api/**'],
    reporter: ['text', 'html'],
    reportsDirectory: './coverage'
  }
  ```
- Target: statement coverage > 70% for `lib/` + `app/api/`
- Add `coverage/` to `.gitignore`

## New npm Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "npx playwright test",
  "test:e2e:ui": "npx playwright test --ui",
  "test:all": "vitest run && npx playwright test"
}
```

## File Structure (Final)

```
tests/
├── helpers/
│   ├── db.js                       # MongoMemoryServer lifecycle
│   └── api.js                      # auth mock + Request factory
├── unit/
│   ├── reminderUtils.test.js       # NEW (~12 tests)
│   ├── format.test.js              # NEW (~8 tests)
│   └── dnd.test.js                 # NEW (~5 tests)
├── integration/
│   ├── reminders-api.test.js       # NEW (~14 tests)
│   ├── reminder-id-api.test.js     # NEW (~24 tests)
│   ├── reorder-api.test.js         # NEW (~8 tests)
│   └── cron-api.test.js            # NEW (~12 tests)
├── utils.test.js                   # EXISTING (50 tests, untouched)
└── ai-tools.test.js                # EXISTING (34 tests, update to use shared db helper)
e2e/
├── playwright.config.js
├── auth.setup.js
├── login.spec.js                   # NEW (~3 tests)
├── task-crud.spec.js               # NEW (~4 tests)
├── search.spec.js                  # NEW (~3 tests)
├── calendar.spec.js                # NEW (~3 tests)
└── ai-modal.spec.js                # NEW (~2 tests)
```

## Test Count Summary

- Existing: 84 (50 unit + 34 integration)
- New Vitest: ~83 (58 integration + 25 unit)
- New E2E: ~15
- **Total: ~182 tests**

## Architectural Decisions (for FYP Report)

1. **Why no component tests**: 31 components are tightly coupled to Next.js App Router, React Query, dnd-kit, and next-auth. The mock surface area is enormous for marginal gain. E2E tests implicitly cover component behavior through real user flows.

2. **Why MongoMemoryServer over mocking**: The app uses raw MongoDB queries (no ORM). Testing against a real MongoDB engine catches query bugs that mocks would miss. MongoMemoryServer is already proven in the existing test suite.

3. **Why Playwright over Cypress**: Lighter install (~50MB vs ~200MB+), native `webServer` config, better Next.js App Router support, and `storageState` auth approach is cleaner.

4. **Why DnD E2E is a stretch goal**: @dnd-kit's PointerSensor with 8px activation distance requires precise pointer coordinates. Playwright's synthetic mouse events have known reliability issues with this pattern. DnD logic is covered by unit tests on pure functions in `lib/dnd.js`.

5. **Why 70% coverage target**: Diminishing returns above 70% for a solo FYP. The target focuses on `lib/` and `app/api/` where business logic lives, not on UI components or config files.
