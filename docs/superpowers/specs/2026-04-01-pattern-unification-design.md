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
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,   // default, explicit for clarity
      refetchOnReconnect: true,     // default
      retry: 1,                     // retry once on failure
    },
  },
}));
```

Auth gating: pass `enabled: !!session` to the query so unauthenticated pages don't fire 401 requests.

**`hooks/useTasks.js` (create)**
Single hook exporting:

```js
const {
  tasks,           // Task[] — all tasks from cache
  loading,         // boolean — maps to TanStack Query's isLoading (not isPending)
                   // true only on initial fetch; background refetches do NOT set this
  toggleComplete,  // (id: string, completed: boolean) => void
  deleteTask,      // (id: string) => void — deferred delete with undo window (see below)
  updateTask,      // ({ id: string, ...patch }) => void
  snoozeTask,      // (id: string, snoozedUntil: string | null) => void
  quickAdd,        // (data: object) => void
  refetch,         // () => void — replaces fetchTasks({ silent: true })
} = useTasks();
```

### Per-Page Operation Matrix

| Operation | Dashboard | Inbox | Calendar | Reminders |
|-----------|-----------|-------|----------|-----------|
| tasks / loading | yes | yes | yes | yes |
| toggleComplete | yes | yes | yes | no |
| deleteTask | yes | yes | yes | yes |
| updateTask | yes | yes | no | yes |
| snoozeTask | yes | no | no | no |
| quickAdd | yes | yes | no | no |
| refetch | yes | yes | no | no |

Pages consume only the operations they need. Unused return values are simply not destructured.

### Modified Files

**`app/dashboard/page.js`**
- Remove: `fetchTasks`, `handleToggleComplete`, `handleDelete`, `handleUpdate`, `handleQuickAdd`, snooze-wake useEffect
- Keep: DnD section logic, `handleReorder`, `completingIds` + animation timer (dashboard-local UI state — coordinates with `toggleComplete` via callback, see Mutation Behavior section), section filtering, all JSX
- Change: `AIReminderModal`'s `onSuccess` callback from `() => fetchTasks({ silent: true })` to `() => refetch()`

**`app/inbox/page.js`**
- Remove: `fetchTasks`, `handleToggleComplete`, `handleDelete`, `handleUpdate`, `handleQuickAdd`
- Keep: Status filter logic, JSX
- Change: `AIReminderModal`'s `onSuccess` callback from `() => fetchTasks({ silent: true })` to `() => refetch()`

**`app/calendar/page.js`**
- Remove: `fetchTasks`, `handleToggleComplete`, `handleDelete`
- Keep: Calendar date navigation, day grouping logic, JSX

**`app/reminders/page.js`**
- Remove: `fetchReminders`, inline delete handler, `handleUpdate`
- Keep: Category/status filter, search, JSX

### Explicitly Untouched

- All API routes (`app/api/reminders/...`)
- `app/reminders/[id]/page.js` — detail page fetches a single reminder by ID, not the list. Out of scope for this hook. Note: after a delete/update on the detail page, the `["tasks"]` cache is not invalidated; this is acceptable since navigating back to a list page triggers a refetch if data is stale.
- `components/search/GlobalSearch.js` — has its own independent `fetchReminders` for search results. Out of scope (search is a different data access pattern).
- `components/reminders/AIReminderModal.js` — internal fetch logic untouched; only `onSuccess` callbacks in consuming pages are updated
- `lib/ai/tools.js`, `lib/utils.js`, `lib/dnd.js`
- All other hooks and components

## Mutation Behavior

### Toggle Complete
1. `onMutate`: Cancel in-flight queries. Snapshot cache. Optimistically update the task's `completed` and `status` fields. Return `{ previous, id }`.
2. `onError`: Restore snapshot. Show `toast.error("更新失敗")`.
3. `onSuccess`: If completing, show `toast.success("已完成")` with an undo action button (3s duration). Undo calls `toggleComplete(id, false)`.
4. `onSettled`: Invalidate `["tasks"]` query to ensure eventual consistency.

**Dashboard animation coordination:** The dashboard maintains a local `completingIds` Set and 1.5s animation timer. The hook's `toggleComplete` returns a Promise (from `mutateAsync`). Dashboard wraps this: on call, it adds the task ID to `completingIds`, starts its 1.5s timer, and calls `toggleComplete`. The `onSettled` invalidation may return new data, but the dashboard's render logic uses `completingIds` to keep the task visually in its original section until the animation timer expires. This is dashboard-local UI state and does not affect other pages.

### Delete (Deferred with Undo Window)
The current dashboard implements a **5-second deferred delete**: the task is removed from UI immediately, an undo toast appears for 5 seconds, and the actual DELETE API call only fires after the undo window expires. This is NOT a standard TanStack Query `useMutation` flow.

Implementation: `deleteTask(id)` is NOT a TanStack Query mutation. It is a plain function inside `useTasks` that:
1. Snapshots the current cache via `queryClient.getQueryData(["tasks"])`
2. Optimistically removes the task via `queryClient.setQueryData`
3. Shows a toast with undo button and a 5-second `setTimeout`
4. If undo is clicked: cancel the timer, restore snapshot via `setQueryData`
5. If timer expires: fire `fetch(DELETE)`, on failure restore snapshot + `toast.error("刪除失敗")`, then `invalidateQueries`

This keeps the existing Todoist-style UX without fighting TanStack Query's mutation lifecycle.

### Update
1. No optimistic update (user explicitly saved, can wait for server).
2. `onSuccess`: Invalidate `["tasks"]` query.
3. `onError`: Show `toast.error("更新失敗")`.

### Snooze / Cancel Snooze
Handles two cases based on `snoozedUntil` value:

**Set snooze (`snoozedUntil` is a date string):**
1. `onMutate`: Snapshot cache. Optimistically set `status: "snoozed"` and `snoozedUntil`.
2. `onError`: Restore snapshot. Show `toast.error("延後失敗")`.
3. `onSuccess`: Show `toast.success("已延後提醒")`.
4. `onSettled`: Invalidate `["tasks"]` query.

**Cancel snooze (`snoozedUntil` is `null`):**
1. `onMutate`: Snapshot cache. Optimistically set `status: "pending"` and `snoozedUntil: null`.
2. `onError`: Restore snapshot. Show `toast.error("取消延後失敗")`.
3. `onSuccess`: Show `toast.success("已取消延後")`.
4. `onSettled`: Invalidate `["tasks"]` query.

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

Currently in `dashboard/page.js` as a side effect during fetch. This is moved into a `useEffect` inside `useTasks` that runs after the initial query succeeds — NOT inside `queryFn` (putting side effects in `queryFn` would cause them to re-fire on retries, `refetchOnWindowFocus`, and manual `refetch()` calls).

```js
// Inside useTasks hook
const wokenIdsRef = useRef(new Set());

useEffect(() => {
  if (!query.data) return;
  const now = new Date();
  query.data.forEach(task => {
    if (task.status === "snoozed" && task.snoozedUntil
        && new Date(task.snoozedUntil) <= now
        && !wokenIdsRef.current.has(task.id)) {
      wokenIdsRef.current.add(task.id);
      // Fire-and-forget PATCH
      fetch(`/api/reminders/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      }).catch(console.error);
      // Optimistically update cache
      queryClient.setQueryData(["tasks"], old =>
        old?.map(t => t.id === task.id ? { ...t, status: "pending", snoozedUntil: null } : t)
      );
    }
  });
}, [query.data]);
```

The `wokenIdsRef` prevents duplicate PATCHes on subsequent refetches. This ensures snooze-wake runs regardless of which page loads first.

## open-ai-modal Event Integration

Both `dashboard/page.js` and `inbox/page.js` listen for the `open-ai-modal` custom event. The event handler only opens the modal (`setIsAIModalOpen(true)`) — it does NOT fetch data. The silent data refresh happens via `AIReminderModal`'s `onSuccess` callback prop, which currently calls `fetchTasks({ silent: true })`. After this change, `onSuccess` calls `refetch()` from the hook instead. The event listeners themselves are unchanged.

## Testing Strategy

- Existing `tests/utils.test.js` is unaffected (tests utility functions, not hooks)
- Manual verification: toggle, delete, update, snooze, quick add on each of the 4 pages
- Verify cross-page cache: complete task on dashboard → navigate to inbox → task shows completed
- Verify rollback: use browser DevTools to block API requests → confirm UI reverts on failure

## DnD Reorder Interaction

Dashboard and inbox use `reorderReminders` from `@/lib/dnd` for drag-and-drop sort order. After a reorder, if `invalidateQueries(["tasks"])` fires (from any mutation's `onSettled`), the server-side sort order refreshes and may override an in-flight optimistic reorder. This is correct behavior — server order is the source of truth, and the optimistic reorder was a temporary visual hint. No special handling needed.

## Out of Scope

- Config consolidation (getCategoryColor, priorityConfig, formatDate) — separate spec
- API route deduplication (formatReminder, normalizeSubtasks) — separate spec
- Splitting large files (AIReminderModal, dashboard) — Phase C
- i18n standardization
- DnD reorder logic (dashboard-specific, stays in page)
- `app/reminders/[id]/page.js` detail page (single-item fetch, different pattern)
- `components/search/GlobalSearch.js` independent search fetch (different data access pattern)
