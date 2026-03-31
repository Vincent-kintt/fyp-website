# Phase B: Pattern Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated fetch + CRUD logic across 4 page components with a shared `useTasks()` hook built on TanStack Query v5.

**Architecture:** Install TanStack Query, wrap the app in `QueryClientProvider`, create `hooks/useTasks.js` with `useQuery` + mutations, then migrate each page from local state to the shared hook — simplest page first, dashboard last.

**Tech Stack:** TanStack Query v5, React 19, Next.js 15 App Router, sonner (toasts)

---

## File Map

- **Install:** `@tanstack/react-query` v5
- **Modify:** `app/providers.js` — add `QueryClientProvider`
- **Create:** `hooks/useTasks.js` — shared data hook
- **Modify:** `app/reminders/page.js` — migrate to hook (simplest)
- **Modify:** `app/calendar/page.js` — migrate to hook
- **Modify:** `app/inbox/page.js` — migrate to hook
- **Modify:** `app/dashboard/page.js` — migrate to hook (most complex)

---

### Task 1: Install TanStack Query + Setup Provider

**Files:**
- Modify: `package.json`
- Modify: `app/providers.js`

- [ ] **Step 1: Install dependency**

```bash
npm install @tanstack/react-query
```

- [ ] **Step 2: Update `app/providers.js`**

Current file (34 lines) has `SessionProvider` + `Toaster` + service worker registration. Add `QueryClientProvider` inside `SessionProvider`.

Replace the full file with:

```js
"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            },
          }}
          richColors
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000 — app should load without errors. Check browser console for no `QueryClient` or provider errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/providers.js
git commit -m "feat: add TanStack Query v5 and setup QueryClientProvider"
```

---

### Task 2: Create `hooks/useTasks.js`

**Files:**
- Create: `hooks/useTasks.js`

This is the core shared hook. It provides: query (fetch + cache), toggleComplete (optimistic + undo), deleteTask (deferred 5s + undo), updateTask, snoozeTask (set + cancel), quickAdd, refetch, and snooze-wake side effect.

- [ ] **Step 1: Create the hook file**

Create `hooks/useTasks.js` with this content:

```js
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

const TASKS_KEY = ["tasks"];

async function fetchTasksFromApi() {
  const res = await fetch("/api/reminders");
  if (!res.ok) throw new Error("Failed to fetch tasks");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch tasks");
  return data.data;
}

export function useTasks() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const wokenIdsRef = useRef(new Set());
  const deleteTimersRef = useRef(new Map());

  // ---- Query ----
  const query = useQuery({
    queryKey: TASKS_KEY,
    queryFn: fetchTasksFromApi,
    enabled: !!session,
  });

  // ---- Snooze-wake side effect ----
  useEffect(() => {
    if (!query.data) return;
    const now = new Date();
    query.data.forEach((task) => {
      if (
        task.status === "snoozed" &&
        task.snoozedUntil &&
        new Date(task.snoozedUntil) <= now &&
        !wokenIdsRef.current.has(task.id)
      ) {
        wokenIdsRef.current.add(task.id);
        fetch(`/api/reminders/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        }).catch(console.error);
        queryClient.setQueryData(TASKS_KEY, (old) =>
          old?.map((t) =>
            t.id === task.id
              ? { ...t, status: "pending", snoozedUntil: null }
              : t
          )
        );
      }
    });
  }, [query.data, queryClient]);

  // ---- Toggle complete (optimistic + undo toast) ----
  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }) =>
      fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData(TASKS_KEY);
      queryClient.setQueryData(TASKS_KEY, (old) =>
        old?.map((t) =>
          t.id === id
            ? {
                ...t,
                completed,
                status: completed ? "completed" : "pending",
                completedAt: completed ? new Date().toISOString() : null,
                snoozedUntil: completed ? null : t.snoozedUntil,
              }
            : t
        )
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous)
        queryClient.setQueryData(TASKS_KEY, context.previous);
      toast.error("更新失敗");
    },
    onSuccess: (_, { id, completed }) => {
      if (completed) {
        toast.success("已完成", {
          action: {
            label: "撤銷",
            onClick: () => toggleMutation.mutate({ id, completed: false }),
          },
          duration: 3000,
        });
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });

  // ---- Deferred delete (5s undo window, NOT a TQ mutation) ----
  const deleteTask = useCallback(
    (id) => {
      const previous = queryClient.getQueryData(TASKS_KEY);
      queryClient.setQueryData(TASKS_KEY, (old) =>
        old?.filter((t) => t.id !== id)
      );

      const timer = setTimeout(async () => {
        deleteTimersRef.current.delete(id);
        try {
          const res = await fetch(`/api/reminders/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed");
          queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        } catch {
          queryClient.setQueryData(TASKS_KEY, previous);
          toast.error("刪除失敗");
        }
      }, 5000);

      deleteTimersRef.current.set(id, timer);

      toast("已刪除", {
        action: {
          label: "撤銷",
          onClick: () => {
            clearTimeout(timer);
            deleteTimersRef.current.delete(id);
            queryClient.setQueryData(TASKS_KEY, previous);
          },
        },
        duration: 5000,
      });
    },
    [queryClient]
  );

  // ---- Update (no optimistic, invalidate on success) ----
  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }) =>
      fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
    onError: () => toast.error("更新失敗"),
  });

  // ---- Snooze / cancel snooze (optimistic) ----
  const snoozeMutation = useMutation({
    mutationFn: ({ id, snoozedUntil }) => {
      const body = snoozedUntil
        ? { status: "snoozed", snoozedUntil }
        : { status: "pending", snoozedUntil: null };
      return fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      });
    },
    onMutate: async ({ id, snoozedUntil }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData(TASKS_KEY);
      queryClient.setQueryData(TASKS_KEY, (old) =>
        old?.map((t) =>
          t.id === id
            ? {
                ...t,
                status: snoozedUntil ? "snoozed" : "pending",
                snoozedUntil: snoozedUntil || null,
              }
            : t
        )
      );
      return { previous };
    },
    onError: (_, { snoozedUntil }, context) => {
      if (context?.previous)
        queryClient.setQueryData(TASKS_KEY, context.previous);
      toast.error(snoozedUntil ? "延後失敗" : "取消延後失敗");
    },
    onSuccess: (_, { snoozedUntil }) => {
      toast.success(snoozedUntil ? "已延後提醒" : "已取消延後");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });

  // ---- Quick add (invalidate on success) ----
  const quickAddMutation = useMutation({
    mutationFn: (data) =>
      fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      toast.success("Task added");
    },
    onError: () => toast.error("新增失敗"),
  });

  // ---- Cleanup delete timers on unmount ----
  useEffect(() => {
    const timers = deleteTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return {
    tasks: query.data ?? [],
    loading: query.isLoading,
    toggleComplete: (id, completed) =>
      toggleMutation.mutateAsync({ id, completed }),
    deleteTask,
    updateTask: (patch) => updateMutation.mutate(patch),
    snoozeTask: (id, snoozedUntil) =>
      snoozeMutation.mutate({ id, snoozedUntil }),
    quickAdd: (data) => quickAddMutation.mutate(data),
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  };
}
```

Key design decisions in the code:
- `toggleComplete` returns a Promise via `mutateAsync` so dashboard can coordinate its `completingIds` animation
- `deleteTask` is a plain `useCallback`, not a TQ mutation, implementing the 5s deferred delete with undo
- `snoozeTask(id, null)` handles cancel-snooze, `snoozeTask(id, dateString)` handles set-snooze
- `loading` maps to `query.isLoading` (true only on initial fetch, not background refetches)
- Snooze-wake runs in a `useEffect` with `wokenIdsRef` to prevent duplicate PATCHes
- Delete timers are cleaned up on unmount

- [ ] **Step 2: Verify hook file has no syntax errors**

```bash
node -e "import('./hooks/useTasks.js')" 2>&1 || echo "Expected: may fail due to JSX/imports, that is OK - we just need no syntax errors"
```

Alternatively, just run `npm run dev` and check there are no build errors. The hook is not yet imported anywhere, so the app should work unchanged.

- [ ] **Step 3: Commit**

```bash
git add hooks/useTasks.js
git commit -m "feat: create shared useTasks hook with TanStack Query v5"
```

---

### Task 3: Migrate `app/reminders/page.js`

**Files:**
- Modify: `app/reminders/page.js`

Simplest migration. This page uses: `tasks/loading`, `deleteTask`, `updateTask`, `refetch`. No toggle, no snooze, no quickAdd.

- [ ] **Step 1: Read the current file**

Read `app/reminders/page.js` (166 lines) to understand the current structure before editing.

- [ ] **Step 2: Replace state + handlers with hook**

The page currently has:
- `useState` for `reminders`, `loading` (lines 13-14)
- `fetchReminders` function (lines 24-38)
- `useEffect` for initial fetch (lines 40-44)
- `handleDelete` function (lines 46-62)
- `handleUpdate` function (lines 64-70)

Replace all of these with the hook. Keep: `isPanelOpen`, `filters`, `filteredReminders`, all JSX.

Changes to make:

a) Add import at top:
```js
import { useTasks } from "@/hooks/useTasks";
```

b) Replace state + fetch + handlers with:
```js
const { tasks: reminders, loading, deleteTask, updateTask, refetch } = useTasks();
```

c) Remove:
- `const [reminders, setReminders] = useState([]);`
- `const [loading, setLoading] = useState(true);`
- The entire `fetchReminders` function
- The `useEffect` that calls `fetchReminders`
- The entire `handleDelete` function
- The entire `handleUpdate` function

d) Update references:
- `handleDelete(id)` calls in JSX → `deleteTask(id)`
- `handleUpdate(updatedReminder)` calls in JSX → replace with `refetch`. **Important:** `TaskEditForm` already calls the API itself (PUT/PATCH). The page's `handleUpdate` only syncs local state. With TanStack Query, just invalidate the cache after the form saves: `onUpdate={refetch}` or `onUpdate={() => refetch()}`.
- `fetchReminders({ silent: true })` in AIReminderModal's `onSuccess` → `refetch()`

- [ ] **Step 3: Verify the page works**

```bash
npm run dev
```

Open http://localhost:3000/reminders. Check:
- Reminders load
- Filter works
- Delete works (should now have 5s undo toast — upgrade from previous immediate delete)
- AIReminderModal creates a reminder and list refreshes

- [ ] **Step 4: Commit**

```bash
git add app/reminders/page.js
git commit -m "refactor: migrate reminders page to useTasks hook"
```

---

### Task 4: Migrate `app/calendar/page.js`

**Files:**
- Modify: `app/calendar/page.js`

This page uses: `tasks/loading`, `toggleComplete`, `deleteTask`. No update, no snooze, no quickAdd.

- [ ] **Step 1: Read the current file**

Read `app/calendar/page.js` (334 lines) to understand the current structure.

- [ ] **Step 2: Replace state + handlers with hook**

The page currently has:
- `useState` for `tasks`, `loading` (lines 29-30)
- `fetchTasks` function (lines 48-61)
- `useEffect` for initial fetch (lines 63-67)
- `handleToggleComplete` function (lines 69-82)
- `handleDelete` function (lines 84-96)

Replace all of these with the hook. Keep: `currentMonth`, `selectedDate`, `viewMode`, hydration useEffect, all calendar JSX.

Changes to make:

a) Add import at top:
```js
import { useTasks } from "@/hooks/useTasks";
```

b) Replace state + fetch + handlers with:
```js
const { tasks, loading, toggleComplete, deleteTask } = useTasks();
```

c) Remove:
- `const [tasks, setTasks] = useState([]);`
- `const [loading, setLoading] = useState(true);`
- The entire `fetchTasks` function
- The `useEffect` that calls `fetchTasks` (the one with `[session]` dependency)
- The entire `handleToggleComplete` function
- The entire `handleDelete` function

d) Update references in JSX:
- `onToggleComplete={handleToggleComplete}` → `onToggleComplete={(id, completed) => toggleComplete(id, completed)}`
- `onDelete={handleDelete}` → `onDelete={(id) => deleteTask(id)}`

e) The loading condition currently checks `status === "loading" || loading || !currentMonth || !selectedDate`. Keep the `!currentMonth || !selectedDate` checks (hydration guard). The `status === "loading"` check can stay as-is (it's for next-auth session loading, separate from data loading).

- [ ] **Step 3: Verify the page works**

```bash
npm run dev
```

Open http://localhost:3000/calendar. Check:
- Calendar renders with tasks on correct dates
- Toggle complete works (should now have optimistic update + undo toast — upgrade from previous no-feedback behavior)
- Delete works (should now have 5s undo — upgrade from previous immediate delete with no toast)

- [ ] **Step 4: Commit**

```bash
git add app/calendar/page.js
git commit -m "refactor: migrate calendar page to useTasks hook"
```

---

### Task 5: Migrate `app/inbox/page.js`

**Files:**
- Modify: `app/inbox/page.js`

This page uses: `tasks/loading`, `toggleComplete`, `deleteTask`, `updateTask`, `quickAdd`, `refetch`. Has DnD for sort order. Has AIReminderModal.

- [ ] **Step 1: Read the current file**

Read `app/inbox/page.js` (365 lines) to understand the current structure.

- [ ] **Step 2: Replace state + handlers with hook**

The page currently has:
- `useState` for `tasks`, `loading` (lines 35-36)
- `fetchTasks` function (lines 56-76) — includes sort by `sortOrder`
- `useEffect` for initial fetch (lines 78-82)
- `handleToggleComplete` function (lines 84-100) — NOT optimistic
- `handleDelete` function (lines 106-122) — NOT optimistic, no undo
- `handleUpdate` function (lines 124-130)
- `handleQuickAdd` function (lines 132-149)

Replace all of these. Keep: `isAIModalOpen`, `aiInitialText`, `activeDragId`, `selectedTaskId`, DnD logic, all JSX.

Changes to make:

a) Add import at top:
```js
import { useTasks } from "@/hooks/useTasks";
```

b) Replace state + fetch + handlers with:
```js
const { tasks: rawTasks, loading, toggleComplete, deleteTask, updateTask, quickAdd, refetch } = useTasks();
```

c) Add sorting (the inbox page sorts by `sortOrder` then `createdAt`, which was previously done in `fetchTasks`):
```js
const tasks = useMemo(
  () =>
    [...rawTasks].sort((a, b) => {
      const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }),
  [rawTasks]
);
```

Add `useMemo` to the React import.

d) Remove:
- `const [tasks, setTasks] = useState([]);`
- `const [loading, setLoading] = useState(true);`
- The entire `fetchTasks` function
- The `useEffect` that calls `fetchTasks`
- The entire `handleToggleComplete` function
- The entire `handleDelete` function
- The entire `handleUpdate` function
- The entire `handleQuickAdd` function

e) Update references in JSX and callbacks:
- `handleToggleComplete(id, completed)` → `toggleComplete(id, completed)`
- `handleDelete(id)` → `deleteTask(id)` (also handle closing detail panel: wrap as `(id) => { if (selectedTaskId === id) setSelectedTaskId(null); deleteTask(id); }`)
- `handleUpdate(task)` → replace with `refetch`. **Important:** `TaskEditForm` calls the API itself. The page's `handleUpdate` only synced local state. With TanStack Query, just invalidate the cache: `onUpdate={() => refetch()}`.
- `handleQuickAdd(data)` → `quickAdd(data)`
- `fetchTasks({ silent: true })` in AIReminderModal `onSuccess` → `refetch()`

f) The `open-ai-modal` event listener (lines 49-54) stays unchanged — it only sets `isAIModalOpen`, does not fetch.

g) DnD `handleDragEnd` currently calls `setTasks` for optimistic reorder and `reorderReminders` for server update. Change `setTasks` calls to `queryClient.setQueryData`. However, the simplest approach is to keep a local `setTasks` for DnD optimistic state. Since the hook returns `tasks` from cache, and DnD reorder needs to optimistically reorder the local list, the cleanest pattern is:

Actually, the DnD reorder modifies the `tasks` array directly via `setTasks`. Since we're removing `setTasks`, the DnD handler needs to use `queryClient.setQueryData` instead. But the inbox component doesn't have direct access to `queryClient`.

Two options:
1. Import `useQueryClient` in the inbox page and use `setQueryData` for DnD reorder
2. Add a `setTasks` function to the hook's return value

Option 1 is cleaner — the hook doesn't need to know about DnD. Add this to the inbox page:

```js
import { useQueryClient } from "@tanstack/react-query";
// ... inside component:
const queryClient = useQueryClient();
```

Then in `handleDragEnd`, replace `setTasks(reordered)` with:
```js
queryClient.setQueryData(["tasks"], (old) =>
  old ? reordered.map((t) => old.find((o) => o.id === t.id) || t) : old
);
```

Wait, that's complex. Actually, the DnD handler just needs to reorder the array. Since `tasks` is derived from the query cache via the hook, we can directly update the cache:

```js
queryClient.setQueryData(["tasks"], reordered);
```

Where `reordered` is the full array with updated `sortOrder` values, same as before.

- [ ] **Step 3: Verify the page works**

```bash
npm run dev
```

Open http://localhost:3000/inbox. Check:
- Tasks load and are sorted by sortOrder
- Toggle complete works with optimistic update + undo toast
- Delete works with 5s undo toast
- Quick add works
- DnD reorder works
- AIReminderModal creates a reminder and list refreshes
- Detail panel (TaskEditForm) opens and updates work

- [ ] **Step 4: Commit**

```bash
git add app/inbox/page.js
git commit -m "refactor: migrate inbox page to useTasks hook"
```

---

### Task 6: Migrate `app/dashboard/page.js`

**Files:**
- Modify: `app/dashboard/page.js`

Most complex migration. This page uses all hook operations plus has dashboard-specific logic: `completingIds` animation, DnD with cross-section status transitions, snooze handling.

- [ ] **Step 1: Read the current file carefully**

Read `app/dashboard/page.js` (939 lines). Pay special attention to:
- `completingIds` / `completingTimers` pattern (lines 62-65, 120-128, 146-184)
- `handleDelete` deferred pattern (lines 208-249)
- `handleSnooze` (lines 263-319)
- `handleDragEnd` (lines 495-621)
- `AIReminderModal` onSuccess (lines 928-936)

- [ ] **Step 2: Add imports**

Add at top:
```js
import { useTasks } from "@/hooks/useTasks";
import { useQueryClient } from "@tanstack/react-query";
```

- [ ] **Step 3: Replace state + handlers**

Inside the component, add:
```js
const {
  tasks: rawTasks,
  loading,
  toggleComplete,
  deleteTask,
  updateTask,
  snoozeTask,
  quickAdd,
  refetch,
} = useTasks();
const queryClient = useQueryClient();
```

Keep these existing state variables:
- `isAIModalOpen`, `aiInitialText` — AI modal UI state
- `activeDragId`, `overSectionId`, `expandedByDrag` — DnD UI state
- `selectedTaskId` — detail panel state
- `completingIds` — animation state

Keep these refs:
- `completingTimers` — animation timers
- `expandTimer` — DnD auto-expand timer

Remove these state variables:
- `const [tasks, setTasks] = useState([]);`
- `const [loading, setLoading] = useState(true);`

Remove these refs:
- `deleteTimers` — now handled inside the hook

- [ ] **Step 4: Remove old fetch + handlers**

Remove entirely:
- `fetchTasks` function (lines 82-112)
- `useEffect` for initial fetch (lines 114-118)
- Snooze-wake logic inside fetchTasks — now in the hook
- `handleDelete` function (lines 208-249) — now in the hook
- `handleUpdate` function (lines 251-257) — now in the hook
- `handleQuickAdd` function (lines 321-338) — now in the hook

- [ ] **Step 5: Rewrite `handleToggleComplete` to use hook**

The dashboard's toggle needs to coordinate with `completingIds`. Replace the old `handleToggleComplete` with:

```js
const handleToggleComplete = useCallback(
  async (id, completed) => {
    if (completed) {
      // Add to completing set for animation hold
      setCompletingIds((prev) => new Set(prev).add(id));
      const timer = setTimeout(() => {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        completingTimers.current.delete(id);
      }, 1500);
      completingTimers.current.set(id, timer);
    } else {
      // Un-completing: clear animation immediately
      clearCompletingId(id);
    }
    // Delegate to hook (returns Promise via mutateAsync)
    try {
      await toggleComplete(id, completed);
    } catch {
      // Hook already handles error toast + rollback
      clearCompletingId(id);
    }
  },
  [toggleComplete, clearCompletingId]
);
```

Keep the existing `clearCompletingId` helper unchanged.

- [ ] **Step 6: Replace handleSnooze with hook call**

Replace the entire `handleSnooze` function with:

```js
const handleSnooze = useCallback(
  (id, snoozedUntil) => {
    snoozeTask(id, snoozedUntil);
  },
  [snoozeTask]
);
```

The hook's `snoozeTask` already handles optimistic update, rollback, and toasts for both set-snooze and cancel-snooze cases.

- [ ] **Step 7: Update DnD handler references**

In `handleDragEnd`, there are places that call `setTasks(...)` for optimistic updates. Replace these with `queryClient.setQueryData(["tasks"], ...)`:

- All `setTasks(newTasks)` → `queryClient.setQueryData(["tasks"], newTasks)`
- All `setTasks(originalTasks)` (rollback) → `queryClient.setQueryData(["tasks"], originalTasks)`
- Where `originalTasks` is captured: change `const originalTasks = [...tasks]` → `const originalTasks = queryClient.getQueryData(["tasks"])`

The `tasks` variable used in DnD logic refers to `rawTasks` from the hook. Update the variable reference from `tasks` to `rawTasks` in DnD code, or alias: `const tasks = rawTasks;` at the top (simpler, less diff).

For minimal diff, add near the hook call:
```js
const tasks = rawTasks;
```

This way all existing references to `tasks` in JSX and DnD code still work.

- [ ] **Step 8: Update remaining references**

- `handleDelete(id)` calls that also close the detail panel: wrap as
  ```js
  const handleDelete = useCallback((id) => {
    if (selectedTaskId === id) setSelectedTaskId(null);
    deleteTask(id);
  }, [deleteTask, selectedTaskId]);
  ```
- `handleUpdate(updatedTask)` → replace with `refetch`. **Important:** `TaskEditForm` calls the API itself. The page's `handleUpdate` only synced local state. With TanStack Query, just invalidate the cache:
  ```js
  const handleUpdate = useCallback(() => refetch(), [refetch]);
  ```
- `handleQuickAdd(data)` → replace with:
  ```js
  const handleQuickAdd = useCallback((data) => {
    quickAdd(data);
  }, [quickAdd]);
  ```
- `fetchTasks({ silent: true })` in AIReminderModal `onSuccess` → `refetch()`
- Remove `fetchTasks` from any other callback references

- [ ] **Step 9: Verify the page works**

```bash
npm run dev
```

Open http://localhost:3000/dashboard. Check thoroughly:
- Tasks load in correct sections (Today, Tomorrow, This Week, etc.)
- Toggle complete: check animation (task stays in section for 1.5s), undo toast appears, undo works
- Delete: check 5s undo toast, undo works
- DnD within section: reorder works
- DnD cross section: status transitions work (e.g., drag to Completed section)
- Snooze: snooze popover works, cancel snooze works
- Quick add: add a task, it appears in list
- AIReminderModal: create via AI, list refreshes
- Navigate to another page and back: data should be cached (no loading flash within 30s)

- [ ] **Step 10: Commit**

```bash
git add app/dashboard/page.js
git commit -m "refactor: migrate dashboard page to useTasks hook"
```

---

### Task 7: Full Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All existing tests pass (they test utility functions, not components).

- [ ] **Step 3: Cross-page cache verification**

Start dev server. In the browser:
1. Go to Dashboard, complete a task (check undo toast appears)
2. Navigate to Inbox — the task should already show as completed (no loading flash)
3. Navigate to Calendar — same
4. Navigate to Reminders — same

- [ ] **Step 4: Error handling verification**

In browser DevTools Network tab, block `api/reminders` requests (right-click → Block request URL). Then:
1. Try to toggle complete — should see error toast and task reverts
2. Try to delete — after 5s should see error toast and task reappears
3. Unblock requests, refresh — everything should work again

- [ ] **Step 5: Commit verification results (if any fixes needed)**

If fixes were needed, commit them:
```bash
git add -A
git commit -m "fix: address issues found during Phase B verification"
```
