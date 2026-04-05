# Inbox Redesign & Notes Sidebar Merge

## Summary

Redesign the Inbox page from a BlockNote editor (desktop) / CaptureInput+RecentFeed (mobile) split into a unified Things 3-style task inbox. Add `inboxState` field and make `dateTime` nullable to support truly unprocessed tasks. Merge the Notes page tree into the app sidebar to eliminate the double-sidebar problem.

## Prerequisites

Phase 2a-2c complete on `UI-design` branch: collapsible sidebar, bottom nav, InboxEditor, capture document API, inline AI task detection.

---

## Part 1: Data Model Changes

### New field: `inboxState`

Add `inboxState: "inbox" | "processed"` to the reminders collection.

- Tasks created from Inbox page → `inboxState: "inbox"`
- Tasks created from QuickAdd/Dashboard/AI → `inboxState: "processed"` (they always have a dateTime)
- Transition: when `dateTime` changes from null to a value, OR when `status` becomes `completed`, server auto-sets `inboxState: "processed"`
- Guard: only fire auto-transition when `existing.inboxState === "inbox"`. Prevents false fires from dashboard drag-drop or AI tool updates
- One-way: clearing `dateTime` back to null does NOT re-enter inbox. Re-entering inbox requires an explicit action (future feature, out of scope)

### Nullable `dateTime`

Make `dateTime` optional (null = unprocessed, no scheduled date).

Files requiring null guards (add early `if (!task.dateTime) return/skip` or conditional rendering):

- `components/tasks/TaskItem.js` — `formatTaskDate()` called on null
- `components/tasks/TaskEditForm.js` — form state initialization
- `components/dashboard/NextTaskCard.js` — sort by dateTime
- `components/dashboard/StatsOverview.js` — date grouping
- `components/calendar/DayTimeline.js` — timeline positioning
- `app/[locale]/(app)/calendar/page.js` — date filtering
- `app/[locale]/(app)/dashboard/page.js` — section sorting (lib/dnd.js)
- `lib/dnd.js` — `getSections()` date comparisons
- `lib/ai/tools.js` — createReminder (Zod schema), checkScheduleConflicts, getReminders
- `lib/ai/prompt.js` — system prompt update (inbox tasks may have no date)
- `components/reminders/ReminderCard.js` — date display
- `components/search/GlobalSearch.js` — search result date formatting
- `lib/format.js` — `formatDateTime()` and `formatRelativeDate()`
- `app/api/cron/notify/route.js` — push notification scheduling (MongoDB `$gte/$lte` naturally excludes null, but message formatting needs guard)

### MongoDB index

Create index: `{ userId: 1, inboxState: 1, createdAt: -1 }` with partial filter `{ inboxState: "inbox" }`.

### Migration

No backfill needed for existing reminders — they all have `dateTime` set. Existing documents without `inboxState` are treated as `"processed"` by convention (query filters for `inboxState: "inbox"` won't match them).

---

## Part 2: API Changes

### GET `/api/reminders`

Add `inboxState` query parameter support. When `inboxState=inbox`:
- Filter: `{ userId, inboxState: "inbox" }`
- Sort: `{ createdAt: -1 }` (not `dateTime`)
- Existing filters (status, category, tag) still work alongside

### POST `/api/reminders`

- Remove `dateTime` required validation — allow null/undefined
- Accept `inboxState` field. Default to `"processed"` if not provided (backward compatible)
- When `inboxState: "inbox"` and no `dateTime`, skip the `dateTime` required check
- QuickAdd behavior unchanged (it always provides dateTime)

### PATCH `/api/reminders/[id]`

Add guarded auto-transition logic after the existing update:

```javascript
if (existing.inboxState === "inbox") {
  if (updateData.dateTime || updateData.status === "completed") {
    updateData.inboxState = "processed";
  }
}
```

### DELETE `/api/inbox/capture`

Remove the entire route. Also remove:
- `scripts/create-capture-index.js`
- The `type: "inbox-capture"` concept from notes
- The `$ne: "inbox-capture"` filter from `GET /api/notes` and `GET /api/notes/trash`
- The 403 guard for inbox-capture in `PATCH/DELETE /api/notes/[noteId]`

Migration: any existing `inbox-capture` documents in the notes collection get `type` field removed (become regular notes).

### `lib/reminderUtils.js`

Add `inboxState` to `formatReminder()` output.

---

## Part 3: React Query & Hooks

### Shared key factory

```javascript
const reminderKeys = {
  all: ["tasks"],
  lists: () => [...reminderKeys.all, "list"],
  list: (filters) => [...reminderKeys.lists(), filters],
};
```

### `hooks/useInboxTasks.js` (new)

- `queryKey: reminderKeys.list({ inboxState: "inbox" })`
- Fetches `GET /api/reminders?inboxState=inbox`
- Returns `{ tasks, loading, addTask, refetch }`
- `addTask()` calls `POST /api/reminders` with `{ title, inboxState: "inbox", dateTime: null }`
- Mutations invalidate `reminderKeys.all` (prefix match) to update both inbox and main task caches

### `hooks/useTasks.js` (modify)

- Update to use `reminderKeys.list({})` as query key
- Mutation `onSuccess` invalidates `reminderKeys.all` (catches inbox too)
- No other changes needed — existing consumers keep working

---

## Part 4: Inbox Page Redesign

### Remove

- `components/inbox/InboxEditor.js` — BlockNote editor
- `components/inbox/CaptureInput.js` — replaced by InboxInput
- `components/inbox/RecentFeed.js` — mixed feed concept removed
- `components/inbox/SuggestionBar.js` — absorbed into InboxInput
- `components/inbox/FloatingSuggestion.js` — BlockNote-specific
- `hooks/useInlineTaskDetection.js` — BlockNote-specific

### `components/inbox/InboxInput.js` (new)

Auto-resize textarea with AI parse integration.

Behavior:
- Collapsed: single-line appearance with "+" icon and "New To-Do" placeholder
- On focus: border highlight, show Cancel/Add action row
- Auto-resize: textarea grows with content (CSS `field-sizing: content` with fallback)
- AI parse: 800ms debounce after typing pause, call `/api/ai/parse-task`
- Suggestion: when parse returns `isTask && confidence.overall >= 0.7`, show inline suggestion bar below input (title · date · time, same visual language as old SuggestionBar)
- Submit: Enter adds task (uses parsed result if available, raw text as title if not). Shift+Enter for newline
- IME: track `compositionstart`/`compositionend`, skip parse during composition
- Stale response: requestId counter, discard responses from before latest edit
- Dismiss: suggestion dismissal tracked by content hash in a Set (not persisted)
- After add: clear input, clear suggestion, refetch inbox tasks

### `components/inbox/InboxTaskRow.js` (new)

Minimal task row for inbox list. Much lighter than TaskItem.

Shows:
- Checkbox (circle, colored by priority — blue default, orange for tags with "work")
- Title text (14px, single line, truncate with ellipsis)
- Optional: one tag pill (only if tags exist, max one shown)

Does NOT show: date, time, icons, drag handle, snooze button, subtask count.

Click entire row → opens `TaskDetailPanel` for triage (set date, add tags, move out of inbox).

### `app/[locale]/(app)/inbox/page.js` (rewrite)

Unified layout, no `useMediaQuery` split:

```
Header: "Inbox" + "{count} unprocessed"
InboxInput (onTaskAdded → refetch)
InboxTaskRow list (from useInboxTasks)
Empty state when count === 0 (inbox zero celebration)
AIReminderModal (Cmd+J)
TaskDetailPanel (on row click)
```

Same layout on mobile and desktop. Only responsive width changes.

---

## Part 5: Notes Sidebar Merge

### Problem

Desktop shows App Sidebar (210px) + Notes Sidebar (240px) = 450px of sidebars before any content.

### Solution

Merge page tree into the app sidebar. Context-aware: Notes section expands only when the current route is `/notes/*`.

### `components/layout/Sidebar.js` (modify)

Add a collapsible "NOTES" section below the existing nav items:

- When current path matches `/notes/*`: section auto-expands, shows page tree with full PageTree component
- When on other pages: section shows just a "Notes" nav link (clickable, navigates to `/notes`)
- Chevron toggle to manually collapse/expand the section
- "+" button to create new note directly from sidebar
- Search icon (future: filter pages)
- Trash link at bottom of notes section

### `components/notes/NotesLayout.js` (remove or gut)

The desktop sidebar portion is removed entirely. NotesLayout becomes a thin wrapper that only handles:
- Mobile: hamburger menu → MobileSidebar (drawer with PageTree) — unchanged
- Desktop: just renders `{children}` with no sidebar (sidebar is now in the app Sidebar)

### `app/[locale]/(app)/notes/[noteId]/page.js` (modify)

- Remove NotesLayout wrapper on desktop (or NotesLayout becomes a pass-through)
- Keep NoteTopBar with breadcrumbs for context
- Notes data fetching may need to lift up to the Sidebar level or use a shared context/hook

### Data flow consideration

Currently NotesLayout receives notes data as props from the page component. With the merge, the page tree in Sidebar needs access to notes data independently. Options:
- Shared `useNotes()` hook with React Query (preferred — consistent with useTasks pattern)
- React context provider at the layout level

Use a new `hooks/useNotes.js` that fetches from `GET /api/notes` with React Query, so both Sidebar and page can consume it independently.

---

## Part 6: Cleanup

### Dependencies to evaluate

- `@floating-ui/react` — check if used elsewhere. If only by FloatingSuggestion, remove from package.json
- `@blocknote/*` packages — still needed for Notes editor, keep

### i18n keys to add

```json
{
  "inbox": {
    "unprocessed": "{count} unprocessed",
    "inboxZero": "Inbox zero!",
    "inboxZeroDesc": "All tasks have been processed.",
    "newTodo": "New To-Do"
  }
}
```

### i18n keys to remove (if unused after cleanup)

- `inbox.editorPlaceholder`
- `inbox.saving`
- `inbox.saved`
- `inbox.capturedTasks`

---

## Files Affected

### Create
- `hooks/useInboxTasks.js` — inbox-specific React Query hook
- `hooks/useNotes.js` — shared notes data hook for Sidebar + pages
- `components/inbox/InboxInput.js` — auto-resize textarea with AI parse
- `components/inbox/InboxTaskRow.js` — minimal inbox task row
- `scripts/migrate-inbox-capture.js` — one-time migration for inbox-capture notes
- `scripts/create-inbox-index.js` — MongoDB index for inboxState

### Modify
- `app/api/reminders/route.js` — nullable dateTime, inboxState filter/field
- `app/api/reminders/[id]/route.js` — guarded auto-transition
- `app/api/notes/route.js` — remove inbox-capture exclusion
- `app/api/notes/trash/route.js` — remove inbox-capture exclusion
- `app/api/notes/[noteId]/route.js` — remove inbox-capture 403 guard
- `lib/reminderUtils.js` — add inboxState to formatReminder
- `lib/format.js` — null guards in date formatters
- `lib/dnd.js` — null guard in getSections
- `lib/ai/tools.js` — nullable dateTime in Zod schemas, null guards
- `lib/ai/prompt.js` — update system prompt for inbox tasks
- `hooks/useTasks.js` — shared query key factory, prefix invalidation
- `app/[locale]/(app)/inbox/page.js` — full rewrite
- `app/[locale]/(app)/dashboard/page.js` — null guard in section logic
- `app/[locale]/(app)/calendar/page.js` — null guard in date filter
- `components/layout/Sidebar.js` — add context-aware Notes section with PageTree
- `components/notes/NotesLayout.js` — remove desktop sidebar, keep mobile drawer
- `components/tasks/TaskItem.js` — null guard in formatTaskDate
- `components/tasks/TaskEditForm.js` — null guard in form init
- `components/dashboard/NextTaskCard.js` — null guard
- `components/dashboard/StatsOverview.js` — null guard
- `components/calendar/DayTimeline.js` — null guard
- `components/reminders/ReminderCard.js` — null guard
- `components/search/GlobalSearch.js` — null guard
- `app/api/cron/notify/route.js` — null guard in message formatting
- `messages/en.json` — new/removed inbox keys
- `messages/zh-TW.json` — new/removed inbox keys

### Delete
- `components/inbox/InboxEditor.js`
- `components/inbox/CaptureInput.js`
- `components/inbox/RecentFeed.js`
- `components/inbox/SuggestionBar.js`
- `components/inbox/FloatingSuggestion.js`
- `hooks/useInlineTaskDetection.js`
- `app/api/inbox/capture/route.js`
- `scripts/create-capture-index.js`

---

## Risks and Mitigations

- **Nullable dateTime breadth**: 15+ files need null guards. Mitigated by doing all guards BEFORE making dateTime optional in the API, so nothing breaks during the transition.
- **Inbox task leaking into views**: Dashboard, calendar, cron all query by dateTime ranges. MongoDB `$gte/$lte` naturally excludes null, so inbox tasks won't appear even without explicit `inboxState` filters. But we add `inboxState` filters as defense-in-depth.
- **React Query cache invalidation**: Shared `reminderKeys.all` prefix ensures any mutation invalidates both inbox and main caches. Tested by: add task in inbox → appears in inbox list. Set date on inbox task → disappears from inbox, appears in Today/Calendar.
- **Notes data flow**: Sidebar needs notes data independently from page. Solved with shared `useNotes()` hook + React Query. Both consumers get the same cached data.
- **Migration**: existing inbox-capture documents become orphaned if not migrated. Migration script converts them to regular notes.
- **IME handling**: InboxInput must track composition events to avoid parsing mid-input for zh-TW users. Reuse the pattern from useInlineTaskDetection (compositionstart/compositionend on the textarea).
