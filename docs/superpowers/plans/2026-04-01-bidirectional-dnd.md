# Bidirectional DnD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable drag-and-drop between ALL Dashboard sections (including Completed and Snoozed) using a custom section-aware collision detection that prevents false cross-section detections.

**Architecture:** Custom collision detection in `lib/dnd.js` uses 2-phase approach: `pointerWithin` identifies which section the pointer is over, then `closestCenter` is scoped to only that section's tasks. `handleDragEnd` in `dashboard/page.js` handles status changes (completed/snoozed) and date changes with optimistic updates and rollback.

**Tech Stack:** @dnd-kit/core v6.3.1, @dnd-kit/sortable v10.0.0, React 19, Next.js 15, TanStack Query

---

### File Structure

- **Modify:** `lib/dnd.js` — Add `createSectionAwareCollision` factory function, add new imports from `@dnd-kit/core`
- **Modify:** `app/(app)/dashboard/page.js` — Update imports, add `taskToSectionRef`, replace collision detection, rewrite `handleDragEnd` cross-section logic

No new files. No API route changes. No component changes.

---

### Task 1: Add `createSectionAwareCollision` to `lib/dnd.js`

**Files:**
- Modify: `lib/dnd.js:1-14` (imports) and append after line 194 (end of file)

- [ ] **Step 1: Add new imports to `lib/dnd.js`**

At the top of `lib/dnd.js`, the current imports from `@dnd-kit/core` are:

```javascript
import {
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
```

Replace with:

```javascript
import {
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  closestCenter,
  getFirstCollision,
} from "@dnd-kit/core";
```

- [ ] **Step 2: Add `createSectionAwareCollision` function at end of file**

Append after the `parseDayDropId` function (after line 194):

```javascript
// Section-aware collision detection for Dashboard bidirectional DnD.
// Based on official @dnd-kit MultipleContainers pattern.
// Phase 1: pointerWithin to find which section the pointer is over.
// Phase 2a: Same section → closestCenter scoped to that section's tasks only.
// Phase 2b: Different section → return section as collision target.
export function createSectionAwareCollision(taskToSectionRef) {
  const sectionIds = new Set(Object.values(SECTION_IDS));

  return function sectionAwareCollision(args) {
    const { droppableContainers, active } = args;

    // Partition: section droppables vs task sortables
    const sectionContainers = droppableContainers.filter(({ id }) =>
      sectionIds.has(id),
    );
    const taskContainers = droppableContainers.filter(
      ({ id }) => !sectionIds.has(id),
    );

    // Phase 1: pointerWithin on sections, fallback to rectIntersection
    let sectionCollisions = pointerWithin({
      ...args,
      droppableContainers: sectionContainers,
    });
    if (sectionCollisions.length === 0) {
      sectionCollisions = rectIntersection({
        ...args,
        droppableContainers: sectionContainers,
      });
    }

    const overSectionId = getFirstCollision(sectionCollisions, "id");

    if (overSectionId != null) {
      const activeSection = taskToSectionRef.current.get(active.id);

      if (overSectionId === activeSection) {
        // Phase 2a: Same section → closestCenter on same-section tasks only
        const sameSectionTasks = taskContainers.filter(
          ({ id }) => taskToSectionRef.current.get(id) === activeSection,
        );
        if (sameSectionTasks.length > 0) {
          return closestCenter({
            ...args,
            droppableContainers: sameSectionTasks,
          });
        }
      }

      // Phase 2b: Different section → return section as target
      return sectionCollisions;
    }

    // Fallback: closestCenter on all tasks (pointer outside all sections)
    return closestCenter({ ...args, droppableContainers: taskContainers });
  };
}
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors in `lib/dnd.js`

- [ ] **Step 4: Commit**

```bash
git add lib/dnd.js
git commit -m "feat(dnd): add createSectionAwareCollision for bidirectional DnD"
```

---

### Task 2: Update Dashboard imports and add `taskToSectionRef`

**Files:**
- Modify: `app/(app)/dashboard/page.js:1-41` (imports) and `app/(app)/dashboard/page.js:60-67` (refs)

- [ ] **Step 1: Update @dnd-kit/core imports — remove `closestCenter`**

In `app/(app)/dashboard/page.js`, change line 16-20 from:

```javascript
import {
  DndContext,
  closestCenter,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
```

To:

```javascript
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
```

- [ ] **Step 2: Update `@/lib/dnd` imports — add status/snooze utilities and collision factory**

Change line 32-41 from:

```javascript
import {
  useDndSensors,
  computeSortOrders,
  reorderReminders,
  SECTION_IDS,
  getSectionTargetDate,
  computeNewDateTime,
  getSectionLabel,
  DROP_ANIMATION_CONFIG,
} from "@/lib/dnd";
```

To:

```javascript
import {
  useDndSensors,
  computeSortOrders,
  reorderReminders,
  patchReminderStatus,
  SECTION_IDS,
  getSectionTargetDate,
  getSectionTargetStatus,
  getDefaultSnoozeUntil,
  computeNewDateTime,
  getSectionLabel,
  DROP_ANIMATION_CONFIG,
  createSectionAwareCollision,
} from "@/lib/dnd";
```

- [ ] **Step 3: Add `taskToSectionRef` and `collisionDetection` memo**

After the existing `const sensors = useDndSensors();` line (line 67), add:

```javascript
  // Ref for collision detection (runs outside React render cycle)
  const taskToSectionRef = useRef(new Map());
```

After the existing `taskToSection` useMemo block (after line 249, after the closing `]);`), add:

```javascript
  // Keep ref in sync for collision detection
  useEffect(() => {
    taskToSectionRef.current = taskToSection;
  }, [taskToSection]);

  // Stable collision detection — ref identity never changes
  const collisionDetection = useMemo(
    () => createSectionAwareCollision(taskToSectionRef),
    [],
  );
```

- [ ] **Step 4: Replace `closestCenter` with `collisionDetection` in DndContext**

Change line 509 from:

```javascript
        collisionDetection={closestCenter}
```

To:

```javascript
        collisionDetection={collisionDetection}
```

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: No errors. The removed `closestCenter` import should not cause unused-import warnings since it was the only usage.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/dashboard/page.js
git commit -m "feat(dnd): wire up section-aware collision detection in Dashboard"
```

---

### Task 3: Rewrite `handleDragEnd` for bidirectional cross-section moves

**Files:**
- Modify: `app/(app)/dashboard/page.js:310-389` (handleDragEnd callback)

- [ ] **Step 1: Replace the entire `handleDragEnd` callback**

Replace lines 310-389 (the full `const handleDragEnd = useCallback(...)`) with:

```javascript
  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveDragId(null);
      setOverSectionId(null);
      setExpandedByDrag(null);
      clearTimeout(expandTimer.current);

      if (!over || active.id === over.id) return;

      const sourceSection = taskToSection.get(active.id);
      const rawTarget = taskToSection.get(over.id) || over.id;
      const validSections = new Set(Object.values(SECTION_IDS));
      const targetSection = validSections.has(rawTarget) ? rawTarget : null;

      if (!sourceSection || !targetSection) return;

      const originalTasks = queryClient.getQueryData(["tasks"]);

      if (sourceSection === targetSection) {
        // Within-section reorder (unchanged)
        const sectionTasks = getSectionTasks(sourceSection);
        const oldIndex = sectionTasks.findIndex((t) => t.id === active.id);
        const newIndex = sectionTasks.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sectionTasks, oldIndex, newIndex);
        const reorderedWithOrder = reordered.map((task, index) => ({
          ...task,
          sortOrder: (index + 1) * 1000,
        }));
        const reorderedIds = new Set(reorderedWithOrder.map((t) => t.id));
        const otherTasks = tasks.filter((t) => !reorderedIds.has(t.id));
        queryClient.setQueryData(
          ["tasks"],
          [...otherTasks, ...reorderedWithOrder],
        );

        try {
          const sortUpdates = computeSortOrders(reordered);
          await reorderReminders(sortUpdates);
        } catch {
          queryClient.setQueryData(["tasks"], originalTasks);
          toast.error("排序失敗");
        }
      } else {
        // Cross-section move
        const draggedTask = tasks.find((t) => t.id === active.id);
        if (!draggedTask) return;

        const STATUS_SECTIONS = new Set([
          SECTION_IDS.COMPLETED,
          SECTION_IDS.SNOOZED,
        ]);
        const isToStatus = STATUS_SECTIONS.has(targetSection);
        const isFromStatus = STATUS_SECTIONS.has(sourceSection);

        // Block invalid transitions: COMPLETED ↔ SNOOZED
        if (isFromStatus && isToStatus) {
          toast.warning("請先恢復任務再操作");
          return;
        }

        if (isToStatus) {
          // Move TO a status section (COMPLETED or SNOOZED)
          const statusBody = { ...getSectionTargetStatus(targetSection) };
          let optimisticUpdate;

          if (targetSection === SECTION_IDS.COMPLETED) {
            optimisticUpdate = {
              ...draggedTask,
              status: "completed",
              completed: true,
              completedAt: new Date().toISOString(),
            };
          } else {
            // SNOOZED — snoozedUntil is required by API
            const snoozedUntil = getDefaultSnoozeUntil();
            statusBody.snoozedUntil = snoozedUntil;
            optimisticUpdate = {
              ...draggedTask,
              status: "snoozed",
              snoozedUntil,
            };
          }

          queryClient.setQueryData(
            ["tasks"],
            tasks.map((t) => (t.id === active.id ? optimisticUpdate : t)),
          );

          try {
            await patchReminderStatus(active.id, statusBody);
            toast.success(`已移至${getSectionLabel(targetSection)}`);
          } catch {
            queryClient.setQueryData(["tasks"], originalTasks);
            toast.error("移動失敗");
          }
        } else {
          // Move TO a date section (from any source)
          const targetDate = getSectionTargetDate(targetSection);
          if (!targetDate) return;

          const newDateTime = computeNewDateTime(
            draggedTask.dateTime,
            targetDate,
          );

          if (isFromStatus) {
            // From COMPLETED/SNOOZED → date section: status reset + date change
            const statusBody = {
              ...getSectionTargetStatus(targetSection),
              dateTime: newDateTime,
            };
            const optimisticUpdate = {
              ...draggedTask,
              status: "pending",
              completed: false,
              dateTime: newDateTime,
              snoozedUntil: null,
            };

            queryClient.setQueryData(
              ["tasks"],
              tasks.map((t) => (t.id === active.id ? optimisticUpdate : t)),
            );

            try {
              await patchReminderStatus(active.id, statusBody);
              toast.success(`已移至${getSectionLabel(targetSection)}`);
            } catch {
              queryClient.setQueryData(["tasks"], originalTasks);
              toast.error("移動失敗");
            }
          } else {
            // Date → Date move (existing logic)
            queryClient.setQueryData(
              ["tasks"],
              tasks.map((t) =>
                t.id === active.id ? { ...t, dateTime: newDateTime } : t,
              ),
            );

            try {
              await reorderReminders([
                {
                  id: active.id,
                  sortOrder: draggedTask.sortOrder || 0,
                  dateTime: newDateTime,
                },
              ]);
              toast.success(`已移至${getSectionLabel(targetSection)}`);
            } catch {
              queryClient.setQueryData(["tasks"], originalTasks);
              toast.error("移動失敗");
            }
          }
        }
      }
    },
    [tasks, taskToSection, getSectionTasks, queryClient],
  );
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run`
Expected: All 84 tests pass (no DnD unit tests exist, but ensures nothing is broken)

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/dashboard/page.js
git commit -m "feat(dnd): enable bidirectional cross-section drag (completed/snoozed)"
```

---

### Task 4: E2E testing with Playwright MCP

**Files:**
- No file changes — manual testing via Playwright MCP browser

- [ ] **Step 1: Restart dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Wait for server to be ready.

- [ ] **Step 2: Navigate to Dashboard and take baseline screenshot**

Use Playwright MCP to navigate to `http://localhost:3000/dashboard` and log in if needed. Take a screenshot to `.playwright-mcp/screenshots/dnd-baseline.png`.

- [ ] **Step 3: Test within-section reorder (the original bug scenario)**

Verify visually that tasks within the same section can be reordered without jumping to other sections. This was the original bug — the most critical test.

- [ ] **Step 4: Test cross-section date moves**

Test dragging a task from one date section to another (e.g., Today → Tomorrow). Verify the task moves and a success toast appears.

- [ ] **Step 5: Test drag to Completed**

Drag a task from a date section to the Completed section. Verify:
- Task disappears from source section
- Task appears in Completed section
- Toast shows "已移至已完成"

- [ ] **Step 6: Test drag to Snoozed**

Drag a task from a date section to the Snoozed section. Verify:
- Task disappears from source section
- Task appears in Snoozed section
- Toast shows "已移至已延後"

- [ ] **Step 7: Test drag from Completed back to a date section**

Drag a task from Completed to Today. Verify:
- Task disappears from Completed
- Task appears in Today
- Toast shows "已移至Today"

- [ ] **Step 8: Test drag from Snoozed back to a date section**

Drag a task from Snoozed to Tomorrow. Verify:
- Task disappears from Snoozed
- Task appears in Tomorrow

- [ ] **Step 9: Test blocked transition (Completed ↔ Snoozed)**

Drag a task from Completed toward Snoozed (or vice versa). Verify:
- Task stays in its original section
- Warning toast shows "請先恢復任務再操作"

- [ ] **Step 10: Take final screenshot and commit**

Take a screenshot to `.playwright-mcp/screenshots/dnd-bidirectional-done.png`.

If all tests pass, no additional commit needed (code was committed in Task 3).
If any fix was needed, commit the fix:

```bash
git add lib/dnd.js app/\(app\)/dashboard/page.js
git commit -m "fix(dnd): address issues found during E2E testing"
```
