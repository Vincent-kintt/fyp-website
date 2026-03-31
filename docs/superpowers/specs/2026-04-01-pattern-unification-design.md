# Phase B: Pattern Unification — useTasks Hook + TanStack Query v5

**Date:** 2026-04-01
**Goal:** Replace duplicated fetch + CRUD + error handling logic across 4 page components with a single shared `useTasks()` hook built on TanStack Query v5. All pages get consistent optimistic updates, rollback, and undo toast behavior.

## Scope

This phase centralizes the data layer only. Page-specific logic (DnD sections, calendar date grouping, inbox filtering) stays in each page. API routes are not modified. AI Modal integration is not modified.

## New Dependency

`@tanstack/react-query` v5 (~13kB gzip). Selected over:
- SWR: weaker mutation support, no built-in optimistic rollback lifecycle
- Server Actions + useOptimistic: no parallel execution, no client cache, no abort signal
- Custom hook without library: would reinvent cache deduplication, stale-while-revalidate, and mutation lifecycle

**Known constraint:** Do NOT mix React's `useOptimistic` with TanStack Query mutations. There is a known bug (TanStack/query#9742) causing UI flicker when `useSyncExternalStore` interacts with React Transitions. All optimistic logic must go through TanStack Query's `onMutate`/`onError` lifecycle exclusively.

## Architecture

### New Files

**`app/providers.js` (modify existing)**
Add `QueryClientProvider` wrapping the existing provider tree. Use `useState` to hold the `QueryClient` instance (prevents re-creation on re-render).

```js
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } }
}));
```

**`hooks/useTasks.js` (create)**
Single hook exporting:

```js
const {
  tasks,           // Task[] — all tasks from cache
  loading,         // boolean — true during initial fetch only
  toggleComplete,  // (id: string, completed: boolean) => void
  deleteTask,      // (id: string) => void
  updateTask,      // ({ id: string, ...patch }) => void
  snoozeTask,      // (id: string, snoozedUntil: string) => void
  quickAdd,        // (data: object) => void
  refetch,         // () => void — replaces fetchTasks({ silent: true })
} = useTasks();
```

### Modified Files

**`app/dashboard/page.js`**
- Remove: `fetchTasks`, `handleToggleComplete`, `handleDelete`, `handleUpdate`, `handleQuickAdd`, snooze-wake useEffect, `open-ai-modal` silent fetch handler's inline fetch
- Keep: DnD section logic, `handleReorder`, `handleSnooze` UI (calls `snoozeTask` from hook), section filtering, all JSX

**`app/inbox/page.js`**
- Remove: `fetchTasks`, `handleToggleComplete`, `handleDelete`, `handleUpdate`, `open-ai-modal` handler's inline fetch
- Keep: Status filter logic, JSX

**`app/calendar/page.js`**
- Remove: `fetchTasks`, `handleToggleComplete`, `handleDelete`
- Keep: Calendar date navigation, day grouping logic, JSX

**`app/reminders/page.js`**
- Remove: `fetchReminders`, inline delete handler
- Keep: Category/status filter, search, JSX

### Untouched

- All API routes (`app/api/reminders/...`)
- `components/reminders/AIReminderModal.js`
- `lib/ai/tools.js`
- `lib/utils.js`
- `lib/dnd.js`
- All other hooks and components

## Mutation Behavior (uniform across all pages)

### Toggle Complete
1. `onMutate`: Cancel in-flight queries. Snapshot cache. Optimistically update the task's `completed` and `status` fields.
2. `onError`: Restore snapshot. Show `toast.error("Failed to update task")`.
3. `onSuccess`: If completing, show `toast.success("已完成")` with an undo action button (3s duration). Undo calls `toggleComplete(id, false)`.
4. `onSettled`: Invalidate `["tasks"]` query to ensure eventual consistency.

### Delete
1. `onMutate`: Cancel in-flight queries. Snapshot cache. Optimistically remove the task.
2. `onError`: Restore snapshot. Show `toast.error("刪除失敗")`.
3. `onSettled`: Invalidate `["tasks"]` query.

### Update
1. No optimistic update (user explicitly saved, can wait for server).
2. `onSuccess`: Invalidate `["tasks"]` query.
3. `onError`: Show `toast.error("更新失敗")`.

### Snooze
1. `onMutate`: Snapshot cache. Optimistically set `status: "snoozed"` and `snoozedUntil`.
2. `onError`: Restore snapshot. Show `toast.error("延後失敗")`.
3. `onSettled`: Invalidate `["tasks"]` query.

### Quick Add
1. `onMutate`: Generate temporary ID. Optimistically insert task into cache.
2. `onSuccess`: Invalidate `["tasks"]` query (replaces temp ID with real one).
3. `onError`: Remove optimistic task. Show `toast.error("新增失敗")`.

## Cache Strategy

- Query key: `["tasks"]`
- `staleTime: 30_000` (30 seconds — page navigation within 30s uses cached data)
- All mutations call `invalidateQueries({ queryKey: ["tasks"] })` on `onSettled` to ensure eventual consistency after optimistic updates
- Cross-page cache sharing: dashboard completes a task → user navigates to inbox → task already shows as completed (no second fetch within staleTime)

## Snooze-Wake Logic

Currently in `dashboard/page.js` as a side effect during fetch. Moved into the `queryFn` of `useTasks`:

```js
async function fetchTasks() {
  const res = await fetch("/api/reminders");
  const data = await res.json();
  const now = new Date();
  // Wake expired snoozed tasks
  return data.data.map(task => {
    if (task.status === "snoozed" && task.snoozedUntil && new Date(task.snoozedUntil) <= now) {
      // Fire-and-forget PATCH to server
      fetch(`/api/reminders/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      }).catch(console.error);
      return { ...task, status: "pending", snoozedUntil: null };
    }
    return task;
  });
}
```

This ensures snooze-wake runs regardless of which page loads first.

## open-ai-modal Event Integration

Both `dashboard/page.js` and `inbox/page.js` listen for the `open-ai-modal` custom event and call `fetchTasks({ silent: true })` as a side effect. After this change, the event handler calls `refetch()` from the hook instead. The event listener stays in each page (it's UI-specific), but the fetch logic is centralized.

## Testing Strategy

- Existing `tests/utils.test.js` is unaffected (tests utility functions, not hooks)
- Manual verification: toggle, delete, update, snooze, quick add on each of the 4 pages
- Verify cross-page cache: complete task on dashboard → navigate to inbox → task shows completed
- Verify rollback: use browser DevTools to block API requests → confirm UI reverts on failure

## Out of Scope

- Config consolidation (getCategoryColor, priorityConfig, formatDate) — separate spec
- API route deduplication (formatReminder, normalizeSubtasks) — separate spec
- Splitting large files (AIReminderModal, dashboard) — Phase C
- i18n standardization
- DnD reorder logic (dashboard-specific, stays in page)
