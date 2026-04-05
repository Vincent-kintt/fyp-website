# Inbox Redesign & Notes Sidebar Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the BlockNote-based inbox with a Things 3-style task inbox using `inboxState` + nullable `dateTime`, and merge the notes page tree into the app sidebar.

**Architecture:** Add `inboxState` field and make `dateTime` nullable in the reminders data model. Build a shared React Query key factory (`lib/queryKeys.js`) consumed by `useTasks`, new `useInboxTasks`, and new `useNotes` hooks. Rewrite the inbox page as a unified layout with auto-resize textarea + minimal task rows. Merge the notes PageTree into the app sidebar with context-aware expand/collapse.

**Tech Stack:** Next.js 15, MongoDB, React Query (TanStack), next-intl, Vitest

---

### Task 1: Create shared query key factory

**Files:**
- Create: `lib/queryKeys.js`

- [ ] **Step 1: Create `lib/queryKeys.js`**

```javascript
export const reminderKeys = {
  all: ["tasks"],
  lists: () => [...reminderKeys.all, "list"],
  list: (filters) => [...reminderKeys.lists(), filters],
};

export const noteKeys = {
  all: ["notes"],
  lists: () => [...noteKeys.all, "list"],
  detail: (id) => [...noteKeys.all, "detail", id],
};
```

- [ ] **Step 2: Run lint**

Run: `npx next lint --file lib/queryKeys.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/queryKeys.js
git commit -m "feat: add shared React Query key factory"
```

---

### Task 2: Add `inboxState` to `formatReminder` and add null guards to `lib/` utilities

**Files:**
- Modify: `lib/reminderUtils.js:7-32`
- Modify: `lib/dnd.js:142-147`

- [ ] **Step 1: Add `inboxState` to `formatReminder()`**

In `lib/reminderUtils.js`, add `inboxState` to the returned object. Find the return statement (around line 20) and add:

```javascript
inboxState: doc.inboxState || null,
```

Add it after the `status` line.

- [ ] **Step 2: Add null guard in `lib/dnd.js` `computeNewDateTime`**

In `lib/dnd.js` at line 142, the function `computeNewDateTime(originalDateTime, targetDate)` calls `original.getHours()`. Add a null guard at the top:

```javascript
export function computeNewDateTime(originalDateTime, targetDate) {
  if (!originalDateTime) return targetDate;
  const original = new Date(originalDateTime);
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- --run`
Expected: All existing tests pass (no behavior change yet)

- [ ] **Step 4: Commit**

```bash
git add lib/reminderUtils.js lib/dnd.js
git commit -m "feat: add inboxState to formatReminder, null guard in dnd.js"
```

---

### Task 3: Add null guards to all UI components that use `dateTime`

This is mechanical work — add early returns or conditional rendering for null `dateTime` in every component listed in the spec.

**Files:**
- Modify: `components/tasks/TaskItem.js:58-71,99-100,109-112,199`
- Modify: `components/tasks/TaskEditForm.js:37-39`
- Modify: `components/dashboard/NextTaskCard.js:23,72`
- Modify: `components/dashboard/StatsOverview.js:10`
- Modify: `components/calendar/DayTimeline.js:36-40,99`
- Modify: `components/reminders/ReminderCard.js` — date display
- Modify: `components/reminders/ToolResultCard.js:53`
- Modify: `components/reminders/ExportButton.js:136`
- Modify: `components/search/GlobalSearch.js` — date formatting
- Modify: `app/[locale]/(app)/calendar/page.js:84,130`
- Modify: `app/[locale]/(app)/dashboard/page.js:172,189,199,229`
- Modify: `app/[locale]/(app)/reminders/[id]/page.js` — dateTime render

- [ ] **Step 1: `TaskItem.js` — guard `formatTaskDate`, `formatTimeOnly`, and `isOverdue`**

In `formatTaskDate` (line 58), add at the top:
```javascript
const formatTaskDate = (dateTime) => {
  if (!dateTime) return null;
  const date = new Date(dateTime);
```

In `formatTimeOnly` (line 109), add:
```javascript
const formatTimeOnly = (dateTime) => {
  if (!dateTime) return null;
```

At line 99-100, guard `isOverdue`:
```javascript
const isOverdue = !currentTask.completed && currentTask.dateTime && isPast(new Date(currentTask.dateTime));
```

At line 199, guard the date display JSX — wrap in `{currentTask.dateTime && (... date rendering ...)}`.

- [ ] **Step 2: `TaskEditForm.js` — allow empty dateTime**

The form init at lines 37-39 already handles null:
```javascript
dateTime: reminder.dateTime
  ? new Date(reminder.dateTime).toISOString().slice(0, 16)
  : "",
```

No change needed for init. But the submit handler must allow empty `dateTime`. Find the validation that checks `formData.dateTime` and make it conditional — only require `dateTime` if the task is NOT in inbox state:

```javascript
if (!formData.title.trim()) {
  setErrors({ title: t("titleRequired") });
  return;
}
// Only require dateTime for non-inbox tasks
if (!formData.dateTime && reminder.inboxState !== "inbox") {
  setErrors({ dateTime: t("dateRequired") });
  return;
}
```

- [ ] **Step 3: `NextTaskCard.js` — guard dateTime**

At line 23:
```javascript
const taskTime = task.dateTime ? new Date(task.dateTime) : null;
```

At line 72, wrap the time display:
```javascript
{taskTime && format(taskTime, "h:mm a")}
```

- [ ] **Step 4: `StatsOverview.js` — filter out null dateTime for overdue**

At line 10:
```javascript
const overdue = tasks.filter(t => !t.completed && t.dateTime && new Date(t.dateTime) < new Date()).length;
```

- [ ] **Step 5: `DayTimeline.js` — filter null dateTime tasks**

In `getTasksForBlock` (line 36), add filter:
```javascript
const getTasksForBlock = (blockStartHour) => {
  return tasks.filter((task) => {
    if (!task.dateTime) return false;
    const hour = new Date(task.dateTime).getHours();
```

At line 99, guard time label:
```javascript
{task.dateTime && format(new Date(task.dateTime), "h:mm")}
```

- [ ] **Step 6: `calendar/page.js` — guard dateTime comparisons**

At line 84 (`isSameDay` guard):
```javascript
if (!draggedTask.dateTime || isSameDay(new Date(draggedTask.dateTime), targetDate)) return;
```

At line 130 (`getTasksForDate`), filter null:
```javascript
const getTasksForDate = (date) =>
  tasks.filter((task) => task.dateTime && isSameDay(new Date(task.dateTime), date));
```

- [ ] **Step 7: `dashboard/page.js` — guard section sorting**

In the section filtering logic (around line 171), add guard at the start of the sort/filter:
```javascript
const datedTasks = rawTasks.filter(t => t.dateTime);
```

Then use `datedTasks` instead of `rawTasks` for all the `isToday`/`isTomorrow`/`isThisWeek`/overdue filtering. Keep `rawTasks` for completed count.

- [ ] **Step 8: `ReminderCard.js`, `ToolResultCard.js`, `ExportButton.js`, `GlobalSearch.js`, `reminders/[id]/page.js` — guard dateTime displays**

For each file, find the `new Date(task.dateTime)` or `new Date(reminder.dateTime)` call and add a null check. The pattern is always the same:

```javascript
// Before
format(new Date(item.dateTime), "MMM d")
// After
item.dateTime ? format(new Date(item.dateTime), "MMM d") : ""
```

Apply this pattern in:
- `ReminderCard.js` — date display
- `ToolResultCard.js:53` — date display
- `ExportButton.js:136` — export formatting
- `GlobalSearch.js` — search result date
- `reminders/[id]/page.js` — detail page date render

- [ ] **Step 9: Run all tests**

Run: `npm run test -- --run`
Expected: All tests pass. Null guards don't change behavior for existing tasks (all have dateTime).

- [ ] **Step 10: Commit**

```bash
git add components/tasks/TaskItem.js components/tasks/TaskEditForm.js \
  components/dashboard/NextTaskCard.js components/dashboard/StatsOverview.js \
  components/calendar/DayTimeline.js components/reminders/ReminderCard.js \
  components/reminders/ToolResultCard.js components/reminders/ExportButton.js \
  components/search/GlobalSearch.js \
  app/[locale]/(app)/calendar/page.js app/[locale]/(app)/dashboard/page.js \
  app/[locale]/(app)/reminders/[id]/page.js
git commit -m "feat: add dateTime null guards across all UI components"
```

---

### Task 4: API — GET with inboxState filter, POST with nullable dateTime

**Files:**
- Modify: `app/api/reminders/route.js:29-53,128-129,156`
- Modify: `app/api/reminders/reorder/route.js` — null guard

- [ ] **Step 1: Update GET handler — default exclude inbox**

In `app/api/reminders/route.js`, after building the base filter (`{ userId: session.user.id }`), add inboxState handling before the existing category/tag filters:

```javascript
const { category, type, tag, inboxState: inboxStateParam } = Object.fromEntries(url.searchParams);

// inboxState filtering — default excludes inbox tasks
if (inboxStateParam === "inbox") {
  filter.inboxState = "inbox";
} else if (inboxStateParam === "all") {
  // no inboxState filter
} else {
  // default: exclude inbox tasks
  filter.inboxState = { $ne: "inbox" };
}
```

Also update the sort: when `inboxStateParam === "inbox"`, sort by `{ createdAt: -1 }` instead of `{ dateTime: 1 }`:

```javascript
const sort = inboxStateParam === "inbox" ? { createdAt: -1 } : { dateTime: 1 };
// ...
.sort(sort)
```

- [ ] **Step 2: Update POST handler — nullable dateTime + inboxState**

At lines 128-129, change the validation:

```javascript
// Before
if (!title || !dateTime) {
  return apiError("Missing required fields (title, dateTime)", 400);
}

// After
if (!title) {
  return apiError("Missing required field (title)", 400);
}
const inboxState = body.inboxState || "processed";
if (inboxState !== "inbox" && !dateTime) {
  return apiError("Missing required field (dateTime) for non-inbox tasks", 400);
}
```

In the document insertion (around line 156), add `inboxState` and handle null dateTime:

```javascript
dateTime: dateTime ? new Date(dateTime) : null,
inboxState,
```

- [ ] **Step 3: Null guard in reorder API**

In `app/api/reminders/reorder/route.js`, find the dateTime truthy branch (around line 40) and add a guard:

```javascript
if (body.dateTime) {
  updateData.dateTime = new Date(body.dateTime);
}
```

This is already truthy-guarded, so just verify it won't break with null dateTime documents. No change needed if the branch is already `if (body.dateTime)`.

- [ ] **Step 4: Write integration test for inbox GET**

Add to `tests/integration/reminders-api.test.js`:

```javascript
describe("GET /api/reminders inboxState filter", () => {
  it("should exclude inbox tasks by default", async () => {
    // Create an inbox task directly in DB
    // GET /api/reminders (no params)
    // Assert inbox task is NOT in results
  });

  it("should return only inbox tasks when inboxState=inbox", async () => {
    // GET /api/reminders?inboxState=inbox
    // Assert only inbox tasks returned, sorted by createdAt desc
  });

  it("should return all tasks when inboxState=all", async () => {
    // GET /api/reminders?inboxState=all
    // Assert both inbox and processed tasks returned
  });
});
```

- [ ] **Step 5: Write integration test for nullable dateTime POST**

Add to `tests/integration/reminders-api.test.js`:

```javascript
describe("POST /api/reminders with inbox", () => {
  it("should allow null dateTime when inboxState is inbox", async () => {
    // POST with { title: "Test", inboxState: "inbox" }
    // Assert 201, dateTime is null
  });

  it("should reject null dateTime when inboxState is processed", async () => {
    // POST with { title: "Test" } (no dateTime, no inboxState)
    // Assert 400
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npm run test -- --run`
Expected: All tests pass including new ones.

- [ ] **Step 7: Commit**

```bash
git add app/api/reminders/route.js app/api/reminders/reorder/route.js \
  tests/integration/reminders-api.test.js
git commit -m "feat: GET inboxState filter, POST nullable dateTime"
```

---

### Task 5: API — PATCH/PUT auto-transition + cron guard

**Files:**
- Modify: `app/api/reminders/[id]/route.js:84-87,240-395`
- Modify: `app/api/cron/notify/route.js`

- [ ] **Step 1: PUT handler — nullable dateTime + auto-transition**

In `app/api/reminders/[id]/route.js`, PUT handler (around line 84):

```javascript
// Before
if (!title || !dateTime) {
  return apiError("Missing required fields (title, dateTime)", 400);
}

// After
if (!title) {
  return apiError("Missing required field (title)", 400);
}
```

In the `updateData` object (around line 139):
```javascript
dateTime: dateTime ? new Date(dateTime) : null,
```

Add auto-transition before `updateOne`:
```javascript
// Auto-transition: inbox → processed when dateTime set or completed
const existing = await remindersCollection.findOne({ _id: new ObjectId(id), userId: session.user.id });
if (existing?.inboxState === "inbox") {
  if (updateData.dateTime || updateData.status === "completed") {
    updateData.inboxState = "processed";
  }
}
```

- [ ] **Step 2: PATCH handler — auto-transition**

In the PATCH handler (around line 360), the dateTime update branch:
```javascript
if (body.dateTime) {
  updateData.dateTime = new Date(body.dateTime);
  updateData.notificationSent = false;
}
```

Add after all field updates are built (before `updateOne`):
```javascript
// Auto-transition: inbox → processed
if (existing.inboxState === "inbox") {
  if (updateData.dateTime || updateData.status === "completed") {
    updateData.inboxState = "processed";
  }
}
```

Note: `existing` is already fetched earlier in PATCH (the `findOne` before updates).

- [ ] **Step 3: Cron notify — null guard**

In `app/api/cron/notify/route.js`, the query already uses `dateTime: { $gte, $lte }` which naturally excludes null. But add a guard in the notification message formatting if `reminder.dateTime` is used in the push payload:

```javascript
const timeStr = reminder.dateTime
  ? format(new Date(reminder.dateTime), "h:mm a")
  : "";
```

- [ ] **Step 4: Write integration test for auto-transition**

Add to `tests/integration/reminder-id-api.test.js`:

```javascript
describe("PATCH auto-transition inboxState", () => {
  it("should transition inbox → processed when dateTime is set", async () => {
    // Create inbox task (inboxState: "inbox", dateTime: null)
    // PATCH with { dateTime: "2026-04-10T09:00" }
    // Assert inboxState is now "processed"
  });

  it("should not transition non-inbox tasks", async () => {
    // Create processed task with dateTime
    // PATCH with new dateTime
    // Assert inboxState unchanged (still "processed" or undefined)
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- --run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add app/api/reminders/[id]/route.js app/api/cron/notify/route.js \
  tests/integration/reminder-id-api.test.js
git commit -m "feat: PATCH/PUT auto-transition inboxState, cron null guard"
```

---

### Task 6: AI tools — inboxState + nullable dateTime

**Files:**
- Modify: `lib/ai/tools.js:49,115,552,564,643,689`
- Modify: `lib/ai/prompt.js`

- [ ] **Step 1: `createReminder` tool — Zod schema + inboxState**

At line 49, change:
```javascript
// Before
dateTime: z.string().describe("ISO format YYYY-MM-DDTHH:mm")
// After
dateTime: z.string().nullable().optional().describe("ISO format YYYY-MM-DDTHH:mm, or null if no date")
```

At line 115, add `inboxState` to the insert:
```javascript
dateTime: dateTime ? new Date(dateTime) : null,
inboxState: "processed",
```

- [ ] **Step 2: `batchCreateReminders` — same changes**

At line 643:
```javascript
dateTime: z.string().nullable().optional().describe("ISO format YYYY-MM-DDTHH:mm")
```

At line 689:
```javascript
dateTime: r.dateTime ? new Date(r.dateTime) : null,
inboxState: "processed",
```

- [ ] **Step 3: `listReminders` — null guard in dateTime formatting**

In the result formatting (around line 220), guard dateTime display:
```javascript
const dateStr = r.dateTime
  ? format(new Date(r.dateTime), "yyyy-MM-dd HH:mm")
  : "No date";
```

- [ ] **Step 4: `findConflicts` — filter out null dateTime**

At line 572, the query already uses `dateTime: { $gte, $lte }` which naturally excludes null. No change needed. But guard the input:

```javascript
if (!dateTime) {
  return { conflicts: [], message: "No dateTime provided — cannot check conflicts" };
}
```

- [ ] **Step 5: Update system prompt**

In `lib/ai/prompt.js`, add a line about inbox tasks:
```
Some tasks may have no dateTime (inbox tasks awaiting triage). When listing these, show "No date" instead of a time.
```

- [ ] **Step 6: Update AI tools test**

In `tests/ai-tools.test.js`, update test fixtures that assume dateTime is always present. Add a test case for creating with null dateTime.

- [ ] **Step 7: Run tests**

Run: `npm run test -- --run`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add lib/ai/tools.js lib/ai/prompt.js tests/ai-tools.test.js
git commit -m "feat: AI tools support inboxState + nullable dateTime"
```

---

### Task 7: Migrate `useTasks` to shared query keys + create `useInboxTasks`

**Files:**
- Modify: `hooks/useTasks.js:9,27,62-220`
- Create: `hooks/useInboxTasks.js`
- Modify: `app/[locale]/(app)/dashboard/page.js:358,374-482`
- Modify: `app/[locale]/(app)/calendar/page.js:89-101`

- [ ] **Step 1: Migrate `useTasks.js` to `reminderKeys`**

Replace `const TASKS_KEY = ["tasks"]` with:
```javascript
import { reminderKeys } from "@/lib/queryKeys";
```

Replace all `TASKS_KEY` references with `reminderKeys.list({})` for the query, and `reminderKeys.all` for invalidation:
- Query: `queryKey: reminderKeys.list({})`
- All `invalidateQueries({ queryKey: TASKS_KEY })` → `invalidateQueries({ queryKey: reminderKeys.all })`
- All `getQueryData(TASKS_KEY)` → `getQueryData(reminderKeys.list({}))`
- All `setQueryData(TASKS_KEY, ...)` → `setQueryData(reminderKeys.list({}), ...)`
- All `cancelQueries({ queryKey: TASKS_KEY })` → `cancelQueries({ queryKey: reminderKeys.all })`

- [ ] **Step 2: Migrate `dashboard/page.js` hard-coded query keys**

Replace all `["tasks"]` with `reminderKeys`:
```javascript
import { reminderKeys } from "@/lib/queryKeys";

// line 358
const originalTasks = queryClient.getQueryData(reminderKeys.list({}));
// lines 374-482: all setQueryData/invalidateQueries
queryClient.setQueryData(reminderKeys.list({}), ...);
```

- [ ] **Step 3: Migrate `calendar/page.js` hard-coded query keys**

Same pattern:
```javascript
import { reminderKeys } from "@/lib/queryKeys";

const originalTasks = queryClient.getQueryData(reminderKeys.list({}));
queryClient.setQueryData(reminderKeys.list({}), ...);
```

- [ ] **Step 4: Create `hooks/useInboxTasks.js`**

```javascript
"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

async function fetchInboxTasks() {
  const res = await fetch("/api/reminders?inboxState=inbox");
  if (!res.ok) throw new Error("Failed to fetch inbox tasks");
  const data = await res.json();
  return data.data || [];
}

export default function useInboxTasks() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: reminderKeys.list({ inboxState: "inbox" }),
    queryFn: fetchInboxTasks,
    enabled: !!session,
  });

  const addMutation = useMutation({
    mutationFn: async (taskData) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          tags: taskData.tags || [],
          priority: taskData.priority || "medium",
          dateTime: taskData.dateTime || null,
          inboxState: "inbox",
        }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });

  const addTask = useCallback(
    (taskData) => addMutation.mutateAsync(taskData),
    [addMutation],
  );

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: reminderKeys.list({ inboxState: "inbox" }) }),
    [queryClient],
  );

  return { tasks, loading, addTask, refetch };
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- --run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add lib/queryKeys.js hooks/useTasks.js hooks/useInboxTasks.js \
  app/[locale]/(app)/dashboard/page.js app/[locale]/(app)/calendar/page.js
git commit -m "feat: migrate to shared query keys, create useInboxTasks hook"
```

---

### Task 8: Create `useNotes` shared hook

**Files:**
- Create: `hooks/useNotes.js`

- [ ] **Step 1: Create `hooks/useNotes.js`**

```javascript
"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { noteKeys } from "@/lib/queryKeys";

async function fetchNotes() {
  const res = await fetch("/api/notes");
  if (!res.ok) throw new Error("Failed to fetch notes");
  const data = await res.json();
  return data.data || [];
}

async function fetchTrashedNotes() {
  const res = await fetch("/api/notes/trash");
  if (!res.ok) throw new Error("Failed to fetch trashed notes");
  const data = await res.json();
  return data.data || [];
}

export default function useNotes() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const t = useTranslations("notes");
  const router = useRouter();

  const { data: notes = [], isLoading: loading } = useQuery({
    queryKey: noteKeys.lists(),
    queryFn: fetchNotes,
    enabled: !!session,
  });

  const { data: trashedNotes = [] } = useQuery({
    queryKey: [...noteKeys.all, "trash"],
    queryFn: fetchTrashedNotes,
    enabled: !!session,
  });

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
    [queryClient],
  );

  const createNote = useCallback(
    async (parentId) => {
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t("untitled"), parentId: parentId || null }),
        });
        const data = await res.json();
        if (data.success) {
          await invalidateAll();
          router.push(`/notes/${data.data.id}`);
          return data.data;
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, router, t],
  );

  const deleteNote = useCallback(
    async (id) => {
      if (!confirm(t("confirmDelete"))) return;
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) await invalidateAll();
      } catch {
        toast.error(t("deleteFailed"));
      }
    },
    [invalidateAll, t],
  );

  const renameNote = useCallback(
    async (id, newTitle) => {
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        const data = await res.json();
        if (data.success) await invalidateAll();
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, t],
  );

  const duplicateNote = useCallback(
    async (id) => {
      try {
        const getRes = await fetch(`/api/notes/${id}`);
        const getData = await getRes.json();
        if (!getData.success) return;
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${getData.data.title} (copy)`,
            parentId: getData.data.parentId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          await fetch(`/api/notes/${data.data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: getData.data.content }),
          });
          await invalidateAll();
          router.push(`/notes/${data.data.id}`);
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, router, t],
  );

  const reorderNotes = useCallback(
    async (updates) => {
      try {
        await fetch("/api/notes/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });
        await invalidateAll();
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, t],
  );

  const restoreNote = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}/restore`, { method: "POST" });
        const data = await res.json();
        if (data.success) await invalidateAll();
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, t],
  );

  const permanentDeleteNote = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) await invalidateAll();
      } catch {
        toast.error(t("deleteFailed"));
      }
    },
    [invalidateAll, t],
  );

  return {
    notes,
    trashedNotes,
    loading,
    createNote,
    deleteNote,
    renameNote,
    duplicateNote,
    reorderNotes,
    restoreNote,
    permanentDeleteNote,
  };
}
```

- [ ] **Step 2: Run lint**

Run: `npx next lint --file hooks/useNotes.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add hooks/useNotes.js
git commit -m "feat: create useNotes shared hook with React Query"
```

---

### Task 9: i18n keys + inbox page InboxInput component

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh-TW.json`
- Create: `components/inbox/InboxInput.js`

- [ ] **Step 1: Add i18n keys**

In `messages/en.json`, under `"inbox"`:
```json
"unprocessed": "{count} unprocessed",
"inboxZero": "Inbox zero!",
"inboxZeroDesc": "All tasks have been processed.",
"newTodo": "New To-Do"
```

In `messages/zh-TW.json`, under `"inbox"`:
```json
"unprocessed": "{count} 個未處理",
"inboxZero": "收件匣清空了！",
"inboxZeroDesc": "所有任務都已處理完畢。",
"newTodo": "新增待辦"
```

- [ ] **Step 2: Create `InboxInput.js`**

```javascript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FiPlus, FiX } from "react-icons/fi";

const DEBOUNCE_MS = 800;
const CONFIDENCE_THRESHOLD = 0.7;

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export default function InboxInput({ onTaskAdded }) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const textareaRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const dismissedRef = useRef(new Set());
  const composingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [text]);

  // IME composition tracking
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onStart = () => { composingRef.current = true; };
    const onEnd = () => { composingRef.current = false; };
    el.addEventListener("compositionstart", onStart);
    el.addEventListener("compositionend", onEnd);
    return () => {
      el.removeEventListener("compositionstart", onStart);
      el.removeEventListener("compositionend", onEnd);
    };
  }, []);

  const parseText = useCallback(
    async (input, reqId) => {
      if (input.trim().length < 3) return;
      if (dismissedRef.current.has(hashString(input.trim()))) return;
      setIsParsing(true);
      try {
        const res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: input,
            language: locale === "zh-TW" ? "zh" : "en",
          }),
        });
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        if (
          data.success &&
          data.data.isTask !== false &&
          (data.data.confidence?.overall || 0) >= CONFIDENCE_THRESHOLD
        ) {
          setParsedResult(data.data);
        } else {
          setParsedResult(null);
        }
      } catch {
        setParsedResult(null);
      } finally {
        setIsParsing(false);
      }
    },
    [locale],
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    setParsedResult(null);
    requestIdRef.current++;
    if (composingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const reqId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => parseText(value, reqId), DEBOUNCE_MS);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (parsedResult) {
      onTaskAdded({
        title: parsedResult.title,
        tags: parsedResult.tags || [],
        priority: parsedResult.priority || "medium",
        dateTime: parsedResult.dateTime || null,
      });
    } else {
      onTaskAdded({ title: trimmed });
    }
    setText("");
    setParsedResult(null);
    setFocused(false);
    textareaRef.current?.blur();
  };

  const handleDismiss = () => {
    dismissedRef.current.add(hashString(text.trim()));
    setParsedResult(null);
  };

  const handleCancel = () => {
    setText("");
    setParsedResult(null);
    setFocused(false);
    textareaRef.current?.blur();
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mb-4">
      <div
        className="rounded-xl px-4 py-3 transition-all"
        style={{
          backgroundColor: "var(--card-bg)",
          border: focused
            ? "1px solid var(--primary)"
            : "1px solid var(--card-border)",
        }}
      >
        <div className="flex items-start gap-3">
          <FiPlus
            size={16}
            className="mt-0.5 flex-shrink-0"
            style={{ color: focused ? "var(--primary)" : "var(--text-muted)" }}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            placeholder={t("newTodo")}
            rows={1}
            className="w-full bg-transparent text-[14px] outline-none resize-none leading-relaxed"
            style={{ color: "var(--text-primary)", minHeight: "20px" }}
          />
        </div>
        {focused && text.trim() && (
          <div className="flex justify-end gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--card-border)" }}>
            <button
              onClick={handleCancel}
              className="text-[12px] px-3 py-1 rounded-md"
              style={{ color: "var(--text-muted)" }}
            >
              {t("cancel") || "Cancel"}
            </button>
            <button
              onClick={handleAdd}
              className="text-[12px] px-3 py-1 rounded-md font-medium"
              style={{
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              {t("add") || "Add"}
            </button>
          </div>
        )}
      </div>
      {/* AI Suggestion Bar */}
      {parsedResult && (
        <div
          className="mt-2 mx-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{
            backgroundColor: "var(--primary-light)",
            border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            color: "var(--primary)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <span className="flex-1 truncate">
            {[
              parsedResult.title,
              parsedResult.dateTime &&
                new Date(parsedResult.dateTime).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                }),
              parsedResult.dateTime &&
                (new Date(parsedResult.dateTime).getHours() ||
                  new Date(parsedResult.dateTime).getMinutes()) &&
                new Date(parsedResult.dateTime).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded hover:opacity-70"
            aria-label="Dismiss"
          >
            <FiX size={12} />
          </button>
        </div>
      )}
      {isParsing && (
        <div className="mt-1 mx-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          {t("parsing")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run lint**

Run: `npx next lint --file components/inbox/InboxInput.js`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/zh-TW.json components/inbox/InboxInput.js
git commit -m "feat: add InboxInput component with AI parse + i18n keys"
```

---

### Task 10: InboxTaskRow component

**Files:**
- Create: `components/inbox/InboxTaskRow.js`

- [ ] **Step 1: Create `InboxTaskRow.js`**

```javascript
"use client";

import { memo } from "react";
import { getPriorityConfig } from "@/lib/utils";

const InboxTaskRow = memo(function InboxTaskRow({ task, onToggleComplete, onClick }) {
  const priorityConfig = getPriorityConfig(task.priority);
  const tag = task.tags?.[0];

  return (
    <button
      onClick={() => onClick?.(task.id || task._id)}
      className="w-full text-left flex items-start gap-3 px-2 py-3 rounded-lg transition-colors"
      style={{ cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.(task.id || task._id, !task.completed);
        }}
        className="mt-0.5 flex-shrink-0"
        aria-label="Toggle complete"
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: `2px solid ${priorityConfig?.color || "var(--text-muted)"}`,
            opacity: 0.5,
          }}
        />
      </button>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] truncate"
          style={{ color: "var(--text-primary)", lineHeight: 1.35 }}
        >
          {task.title}
        </div>
        {tag && (
          <span
            className="text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `color-mix(in srgb, ${priorityConfig?.color || "var(--primary)"} 12%, transparent)`,
              color: priorityConfig?.color || "var(--primary)",
            }}
          >
            {tag}
          </span>
        )}
      </div>
    </button>
  );
});

export default InboxTaskRow;
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/InboxTaskRow.js
git commit -m "feat: add InboxTaskRow minimal task row component"
```

---

### Task 11: Rewrite inbox page

**Files:**
- Modify: `app/[locale]/(app)/inbox/page.js` (full rewrite)

- [ ] **Step 1: Rewrite `inbox/page.js`**

```javascript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderKeys } from "@/lib/queryKeys";

import useInboxTasks from "@/hooks/useInboxTasks";
import InboxInput from "@/components/inbox/InboxInput";
import InboxTaskRow from "@/components/inbox/InboxTaskRow";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("inbox");
  const queryClient = useQueryClient();
  const { tasks, loading, addTask, refetch } = useInboxTasks();

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Cmd+J → AI modal
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsAIModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = () => setIsAIModalOpen(true);
    window.addEventListener("open-ai-modal", handler);
    return () => window.removeEventListener("open-ai-modal", handler);
  }, []);

  const handleTaskAdded = useCallback(
    async (taskData) => {
      try {
        await addTask(taskData);
      } catch {
        toast.error(t("addFailed"));
      }
    },
    [addTask, t],
  );

  const handleToggleComplete = useCallback(
    async (id, completed) => {
      try {
        await fetch(`/api/reminders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        });
        queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      } catch {
        toast.error(t("addFailed"));
      }
    },
    [queryClient, t],
  );

  const fetchTasks = useCallback(
    ({ silent } = {}) => {
      if (silent) refetch();
    },
    [refetch],
  );

  if (status === "loading" || loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
        <div className="h-8 w-32 rounded animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        <div className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
        {t("title")}
      </h1>
      {tasks.length > 0 && (
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {t("unprocessed", { count: tasks.length })}
        </p>
      )}
      {tasks.length === 0 && !loading && <div className="mb-4" />}

      <InboxInput onTaskAdded={handleTaskAdded} />

      {tasks.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {t("inboxZero")}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {t("inboxZeroDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {tasks.map((task) => (
            <InboxTaskRow
              key={task._id || task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onClick={(id) => setSelectedTaskId(id)}
            />
          ))}
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: reminderKeys.all })}
        />
      )}

      <AIReminderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        fetchTasks={fetchTasks}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify inbox page loads**

Run: `npm run dev`
Navigate to `/inbox`. Verify: header, input, empty state or task list renders without errors.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/inbox/page.js
git commit -m "feat: rewrite inbox page — Things 3 style, unified layout"
```

---

### Task 12: Notes sidebar merge — Sidebar.js + useNotes integration

**Files:**
- Modify: `components/layout/Sidebar.js`

- [ ] **Step 1: Add Notes page tree to Sidebar**

In `components/layout/Sidebar.js`:

1. Import at top:
```javascript
import { usePathname } from "@/i18n/navigation";
import { FiChevronDown, FiChevronRight, FiPlus } from "react-icons/fi";
import useNotes from "@/hooks/useNotes";
import PageTree from "@/components/notes/PageTree";
```

2. Replace the static "Notes" item in `WORKSPACE_ITEMS` with a dynamic section. Inside the component, add:

```javascript
const pathname = usePathname();
const isNotesPage = pathname?.startsWith("/notes");

const {
  notes, trashedNotes, createNote, deleteNote,
  reorderNotes, renameNote, duplicateNote, restoreNote, permanentDeleteNote,
} = useNotes();

const [notesExpanded, setNotesExpanded] = useState(false);

// Auto-expand when on notes page
useEffect(() => {
  if (isNotesPage) setNotesExpanded(true);
}, [isNotesPage]);

// Extract activeNoteId from pathname
const activeNoteId = isNotesPage
  ? pathname.split("/notes/")[1]?.split("/")[0] || null
  : null;
```

3. In the JSX, replace the Notes workspace item with a collapsible section. Between the divider and "All Tasks" item:

```jsx
{/* Notes section */}
{!collapsed && (
  <div>
    <div className="flex items-center justify-between px-2 py-1">
      <button
        onClick={() => setNotesExpanded((p) => !p)}
        className="flex items-center gap-1 text-[10px] font-semibold"
        style={{ color: "var(--text-muted)", letterSpacing: "0.5px" }}
      >
        {notesExpanded ? <FiChevronDown size={10} /> : <FiChevronRight size={10} />}
        NOTES
      </button>
      <button
        onClick={() => createNote(null)}
        className="p-0.5 rounded hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
      >
        <FiPlus size={13} />
      </button>
    </div>
    {notesExpanded && notes.length > 0 && (
      <div className="max-h-[300px] overflow-y-auto">
        <PageTree
          notes={notes}
          activeNoteId={activeNoteId}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
          onReorder={reorderNotes}
          onRename={renameNote}
          onDuplicate={duplicateNote}
          trashedNotes={trashedNotes}
          onRestore={restoreNote}
          onPermanentDelete={permanentDeleteNote}
        />
      </div>
    )}
    {notesExpanded && notes.length === 0 && (
      <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {t("notes.noPages") || "No pages yet"}
      </div>
    )}
  </div>
)}
{collapsed && (
  /* Keep collapsed Notes icon that links to /notes */
)}
```

4. Remove "Notes" from the `WORKSPACE_ITEMS` array (keep "All Tasks" only).

- [ ] **Step 2: Run dev server and verify sidebar on notes page**

Navigate to `/notes/[someId]`. Verify: page tree appears in sidebar, active note highlighted, no second sidebar.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.js
git commit -m "feat: merge notes page tree into app sidebar"
```

---

### Task 13: Gut NotesLayout desktop sidebar + migrate note page

**Files:**
- Modify: `components/notes/NotesLayout.js`
- Modify: `app/[locale]/(app)/notes/[noteId]/page.js`

- [ ] **Step 1: Remove desktop sidebar from NotesLayout**

In `NotesLayout.js`, remove the entire desktop `<aside>` block (lines 153-215), the expand button (lines 218-239), the peek trigger/overlay (lines 242-274), and the resize handle logic. Keep only:
- Mobile menu button (line 277-288)
- MobileSidebar drawer (line 293-297)
- `{children}` section (line 299-303)

The component becomes:

```javascript
export default function NotesLayout({
  notes, activeNoteId, onCreateNote, onDeleteNote, onReorder,
  onRename, onDuplicate, trashedNotes, onRestore, onPermanentDelete,
  children,
}) {
  const t = useTranslations("notes");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const treeProps = {
    notes, activeNoteId, onCreateNote, onDeleteNote, onReorder,
    onRename, onDuplicate, trashedNotes, onRestore, onPermanentDelete,
  };

  return (
    <div className="flex h-full">
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-[4.5rem] left-4 z-30 p-2 rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={() => setDrawerOpen(true)}
        aria-label={t("openSidebar")}
      >
        <Menu size={16} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
      </button>
      <MobileSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} {...treeProps} />
      <section className="flex-1 overflow-y-auto" style={{ background: "var(--surface)" }}>
        {children}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Migrate `notes/[noteId]/page.js` to `useNotes`**

Replace the local state + manual fetch with `useNotes()`. The page becomes much simpler:

```javascript
import useNotes from "@/hooks/useNotes";

export default function NotePage() {
  const { noteId } = useParams();
  const router = useRouter();
  const t = useTranslations("notes");
  const locale = useLocale();

  const {
    notes, trashedNotes, createNote, deleteNote,
    reorderNotes, renameNote, duplicateNote, restoreNote, permanentDeleteNote,
  } = useNotes();

  // currentNote — page-level fetch (needs content, not just list data)
  const [currentNote, setCurrentNote] = useState(null);
  const [editorSaveStatus, setEditorSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentNote = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      const data = await res.json();
      if (data.success) setCurrentNote(data.data);
      else router.replace("/notes");
    } catch { router.replace("/notes"); }
    finally { setLoading(false); }
  }, [noteId, router]);

  useEffect(() => { fetchCurrentNote(); }, [fetchCurrentNote]);

  // ... handleSave, handleIconChange stay the same but simplified ...
  // ... rest of component stays the same, using useNotes mutations for tree operations ...
```

The key change: `handleCreateNote`, `handleDeleteNote`, `handleReorder`, `handleRename`, `handleDuplicate`, `handleRestore`, `handlePermanentDelete` all delegate to `useNotes()` methods instead of local implementations.

- [ ] **Step 3: Run dev server and verify notes page**

Navigate to a note page. Verify: single sidebar with page tree, note editor works, create/delete/rename work.

- [ ] **Step 4: Commit**

```bash
git add components/notes/NotesLayout.js app/[locale]/(app)/notes/[noteId]/page.js
git commit -m "feat: gut NotesLayout desktop sidebar, migrate to useNotes hook"
```

---

### Task 14: Cleanup — delete old inbox components + capture API

**Files:**
- Delete: `components/inbox/InboxEditor.js`
- Delete: `components/inbox/CaptureInput.js`
- Delete: `components/inbox/RecentFeed.js`
- Delete: `components/inbox/SuggestionBar.js`
- Delete: `components/inbox/FloatingSuggestion.js`
- Delete: `hooks/useInlineTaskDetection.js`
- Delete: `app/api/inbox/capture/route.js`
- Delete: `scripts/create-capture-index.js`
- Modify: `app/api/notes/route.js:20`
- Modify: `app/api/notes/trash/route.js:15-19`
- Modify: `app/api/notes/[noteId]/route.js:106-112,159-161`

- [ ] **Step 1: Delete old inbox components**

```bash
rm components/inbox/InboxEditor.js \
   components/inbox/CaptureInput.js \
   components/inbox/RecentFeed.js \
   components/inbox/SuggestionBar.js \
   components/inbox/FloatingSuggestion.js \
   hooks/useInlineTaskDetection.js \
   app/api/inbox/capture/route.js \
   scripts/create-capture-index.js
```

- [ ] **Step 2: Remove inbox-capture references from notes API**

In `app/api/notes/route.js` at line 20, remove the `type: { $ne: "inbox-capture" }` filter:
```javascript
// Before
.find({ userId: session.user.id, deletedAt: null, type: { $ne: "inbox-capture" } })
// After
.find({ userId: session.user.id, deletedAt: null })
```

In `app/api/notes/trash/route.js`, same removal:
```javascript
// Before
.find({ userId: session.user.id, deletedAt: { $ne: null }, type: { $ne: "inbox-capture" } })
// After
.find({ userId: session.user.id, deletedAt: { $ne: null } })
```

In `app/api/notes/[noteId]/route.js`, remove the 403 guards for inbox-capture in both PATCH (lines 106-112) and DELETE (lines 159-161). Delete those `if (existingNote?.type === "inbox-capture")` blocks entirely.

- [ ] **Step 3: Remove `@floating-ui/react` dependency**

```bash
npm uninstall @floating-ui/react
```

- [ ] **Step 4: Remove `.ai-task-highlight` CSS class from `globals.css`**

Find and remove:
```css
.ai-task-highlight {
  border-left: 3px solid var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, transparent);
  border-radius: 4px;
  transition: background 150ms ease, border-color 150ms ease;
}
```

- [ ] **Step 5: Remove unused i18n keys**

In both `messages/en.json` and `messages/zh-TW.json`, remove:
- `inbox.editorPlaceholder`
- `inbox.saving`
- `inbox.saved`
- `inbox.capturedTasks`

- [ ] **Step 6: Run build to check for import errors**

Run: `npm run build`
Expected: Build succeeds with no import errors referencing deleted files.

- [ ] **Step 7: Run all tests**

Run: `npm run test -- --run`
Expected: All pass (tests referencing deleted files should have been updated or removed in earlier tasks)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: delete old inbox components, capture API, floating-ui dep"
```

---

### Task 15: Migration scripts + MongoDB index

**Files:**
- Create: `scripts/migrate-inbox-capture.js`
- Create: `scripts/create-inbox-index.js`

- [ ] **Step 1: Create `scripts/migrate-inbox-capture.js`**

```javascript
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function migrate() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const notes = db.collection("notes");

    // Find all inbox-capture documents
    const captures = await notes.find({ type: "inbox-capture" }).toArray();
    console.log(`Found ${captures.length} inbox-capture documents`);

    for (const doc of captures) {
      await notes.updateOne(
        { _id: doc._id },
        {
          $set: { title: "Inbox Notes (migrated)" },
          $unset: { type: "" },
        },
      );
      console.log(`Migrated: ${doc._id}`);
    }

    // Drop the old partial index if it exists
    try {
      await notes.dropIndex("userId_1_type_1");
      console.log("Dropped old inbox-capture partial index");
    } catch {
      console.log("No inbox-capture index to drop (already removed or different name)");
    }

    console.log("Migration complete");
  } finally {
    await client.close();
  }
}

migrate().catch(console.error);
```

- [ ] **Step 2: Create `scripts/create-inbox-index.js`**

```javascript
import { MongoClient } from "mongodb";
import "dotenv/config";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function createIndex() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const reminders = db.collection("reminders");

    const result = await reminders.createIndex(
      { userId: 1, inboxState: 1, createdAt: -1 },
      {
        partialFilterExpression: { inboxState: "inbox" },
        name: "inbox_state_partial",
      },
    );
    console.log("Created inbox index:", result);
  } finally {
    await client.close();
  }
}

createIndex().catch(console.error);
```

- [ ] **Step 3: Add npm scripts to `package.json`**

```json
"migrate-inbox-capture": "node scripts/migrate-inbox-capture.js",
"create-inbox-index": "node scripts/create-inbox-index.js"
```

- [ ] **Step 4: Run the migration and index creation**

```bash
npm run migrate-inbox-capture
npm run create-inbox-index
```

Expected: Migration reports found documents (or 0 if none), index created successfully.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-inbox-capture.js scripts/create-inbox-index.js package.json
git commit -m "chore: add inbox migration script and MongoDB index"
```

---

### Task 16: Smoke test — full verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test -- --run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

Start dev server: `npm run dev`

Test inbox:
1. Navigate to `/inbox` — should see empty state or existing tasks
2. Type "Buy milk tomorrow" in input — AI suggestion should appear
3. Press Enter — task appears in inbox list
4. Click task row — TaskDetailPanel opens
5. Set a date in detail panel, save — task disappears from inbox (processed)
6. Check `/dashboard` — task appears in Today/Tomorrow section

Test notes sidebar:
1. Navigate to `/notes/[id]` — page tree in sidebar, no second sidebar
2. Create note from sidebar "+" button — works
3. Navigate to `/dashboard` — Notes section collapsed, just a link
4. On mobile — hamburger menu still opens drawer with page tree

- [ ] **Step 5: Final commit if any smoke test fixes needed**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```
