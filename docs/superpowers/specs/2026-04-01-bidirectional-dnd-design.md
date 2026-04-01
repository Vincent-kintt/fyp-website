# Bidirectional DnD: Section-Aware Collision Detection

**Date**: 2026-04-01
**Status**: Draft
**Scope**: Dashboard drag-and-drop — enable cross-section moves to ALL sections while preserving within-section reorder stability

## Problem

Commit `edecba9` added bidirectional DnD (drag to COMPLETED/SNOOZED), but `closestCenter` collision detection combined with large section droppable zones caused false cross-section detections during within-section reorder. The fix (commit `1ee5b81`) reverted to date-only cross-section moves, losing drag-to-COMPLETED and drag-to-SNOOZED.

## Solution

Custom collision detection based on the official @dnd-kit `MultipleContainers.tsx` pattern, adapted for our vertically-stacked computed sections.

## Architecture

### Custom Collision Detection: `createSectionAwareCollision`

Located in `lib/dnd.js`. Factory function that accepts a `taskToSectionRef` (React ref holding `Map<taskId, sectionId>`).

**Algorithm (2-phase):**

1. **Phase 1 — Which section is the pointer over?**
   - Run `pointerWithin` on section droppables only (IDs starting with `section-`)
   - Fallback to `rectIntersection` if `pointerWithin` returns empty

2. **Phase 2 — Determine target**
   - If pointer is in the **same section** as the dragged item:
     → Run `closestCenter` filtered to only that section's task items
     → This enables normal sortable reorder (items shift during drag)
   - If pointer is in a **different section**:
     → Return the section ID as the collision target
     → This triggers cross-section move logic in `handleDragEnd`

3. **Fallback** — If no section detected (pointer outside all sections):
   → Run `closestCenter` on all task items (graceful degradation)

**Why this works:** `closestCenter` is never run across section boundaries. It only ever compares items within the same section, eliminating the false cross-section detection that caused the original bug.

### Collision Function Signature

```javascript
// lib/dnd.js
import {
  pointerWithin,
  rectIntersection,
  closestCenter,
  getFirstCollision,
} from "@dnd-kit/core";

export function createSectionAwareCollision(taskToSectionRef) {
  const sectionIds = new Set(Object.values(SECTION_IDS));

  return function sectionAwareCollision(args) {
    const { droppableContainers, active } = args;

    // Partition: section droppables vs task sortables
    const sectionContainers = droppableContainers.filter(
      ({ id }) => sectionIds.has(id)
    );
    const taskContainers = droppableContainers.filter(
      ({ id }) => !sectionIds.has(id)
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
        // Phase 2a: Same section → closestCenter on same-section tasks
        const sameSectionTasks = taskContainers.filter(
          ({ id }) => taskToSectionRef.current.get(id) === activeSection
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

    // Fallback: closestCenter on all tasks
    return closestCenter({ ...args, droppableContainers: taskContainers });
  };
}
```

### handleDragEnd Cross-Section Logic

**Status transition rules** (verified from `lib/utils.js` STATUS_TRANSITIONS):
- `pending/in_progress` → `completed`: Valid
- `pending/in_progress` → `snoozed`: Valid
- `completed` → `pending`: Valid
- `snoozed` → `pending`: Valid
- `completed` → `snoozed`: INVALID (must go through `pending`)
- `snoozed` → `completed`: INVALID (must go through `pending`)

**API field name**: `snoozedUntil` (with "d"). Required when status = "snoozed".

**Cross-section move matrix:**

| Source → Target | API Call | Body |
|---|---|---|
| Date → Date | `reorderReminders([{ id, sortOrder, dateTime }])` | New dateTime from `computeNewDateTime` |
| Date → COMPLETED | `patchReminderStatus(id, { status: "completed", completed: true })` | |
| Date → SNOOZED | `patchReminderStatus(id, { status: "snoozed", snoozedUntil })` | `snoozedUntil` from `getDefaultSnoozeUntil()` |
| COMPLETED → Date | `patchReminderStatus(id, { status: "pending", completed: false, dateTime })` | API auto-clears snoozedUntil |
| SNOOZED → Date | `patchReminderStatus(id, { status: "pending", completed: false, dateTime })` | API auto-clears snoozedUntil |
| COMPLETED → SNOOZED | **BLOCKED** — show toast "請先恢復任務" | Invalid transition |
| SNOOZED → COMPLETED | **BLOCKED** — show toast "請先恢復任務" | Invalid transition |
| COMPLETED → COMPLETED | No-op (same section reorder only) | |
| SNOOZED → SNOOZED | No-op (same section reorder only) | |

### handleDragEnd Pseudocode

```
onDragEnd(active, over):
  if !over or active.id === over.id → return

  sourceSection = taskToSection.get(active.id)
  targetSection = sectionIds.has(over.id) ? over.id : taskToSection.get(over.id)
  if !sourceSection or !targetSection → return

  if sourceSection === targetSection:
    // Within-section reorder (existing logic, unchanged)
    arrayMove → optimistic update → computeSortOrders → reorderReminders

  else:
    draggedTask = tasks.find(t => t.id === active.id)
    isStatusSection = target is COMPLETED or SNOOZED
    isFromStatusSection = source is COMPLETED or SNOOZED

    // Block invalid transitions: COMPLETED ↔ SNOOZED
    if isFromStatusSection and isStatusSection and sourceSection !== targetSection:
      toast.warning("請先恢復任務再操作")
      return

    if isStatusSection:
      // Move TO status section
      statusBody = getSectionTargetStatus(targetSection)
      if targetSection === SNOOZED:
        statusBody.snoozedUntil = getDefaultSnoozeUntil()
      optimistic update → patchReminderStatus(active.id, statusBody) → toast
    else:
      // Move TO date section (from any source)
      targetDate = getSectionTargetDate(targetSection)
      newDateTime = computeNewDateTime(draggedTask.dateTime, targetDate)
      body = { dateTime: newDateTime }
      if isFromStatusSection:
        // Coming from COMPLETED or SNOOZED — need status reset
        body = { ...getSectionTargetStatus(targetSection), dateTime: newDateTime }
        optimistic update → patchReminderStatus(active.id, body) → toast
      else:
        // Date → Date move
        optimistic update → reorderReminders([{ id, sortOrder, dateTime }]) → toast
```

### Optimistic State Shape Per Move Type

Each cross-section move must update the task object in `queryClient` so it immediately appears in the correct section.

**→ COMPLETED:**
```
{ ...task, status: "completed", completed: true, completedAt: new Date().toISOString() }
```

**→ SNOOZED:**
```
{ ...task, status: "snoozed", snoozedUntil: getDefaultSnoozeUntil() }
```

**COMPLETED/SNOOZED → Date section:**
```
{ ...task, status: "pending", completed: false, dateTime: newDateTime, snoozedUntil: null }
```

**Date → Date:**
```
{ ...task, dateTime: newDateTime }
```

### taskToSectionRef Pattern

The collision detection function runs outside React's render cycle, so it needs a ref (not a memo'd value) to access the current `taskToSection` map.

```javascript
// In DashboardPage component:
const taskToSectionRef = useRef(new Map());
useEffect(() => {
  taskToSectionRef.current = taskToSection;
}, [taskToSection]);

// Pass to collision detection:
const collisionDetection = useMemo(
  () => createSectionAwareCollision(taskToSectionRef),
  [] // stable — ref identity never changes
);
```

## Files Changed

- **`lib/dnd.js`** — Add `createSectionAwareCollision()`, add imports (`pointerWithin`, `rectIntersection`, `getFirstCollision`)
- **`app/(app)/dashboard/page.js`** — Remove `closestCenter` import from `@dnd-kit/core`, add `createSectionAwareCollision` import from `lib/dnd`, restore imports (`patchReminderStatus`, `getSectionTargetStatus`, `getDefaultSnoozeUntil`), add `taskToSectionRef` ref + sync effect, replace collision prop, update `handleDragEnd`

## Files NOT Changed

- `TaskSection.js` — droppable stays inside TaskListContent (no change)
- `SortableTaskItem.js` — no change
- `TaskItem.js` — no change
- API routes — no change
- `lib/utils.js` — no change

## Risk Mitigation

- Custom collision function is isolated in `lib/dnd.js` — easy to swap back to `closestCenter` if issues arise
- Droppable zone positions are NOT changed (stay inside TaskListContent)
- Invalid status transitions are blocked client-side with user-friendly toast
- All optimistic updates include rollback on API failure

## Testing Plan

- Within-section reorder in Overdue (the original bug scenario)
- Within-section reorder in Today, Tomorrow, This Week
- Cross-section: Today → Tomorrow (date move)
- Cross-section: Overdue → Today (date move)
- Cross-section: Today → Completed (mark complete)
- Cross-section: Today → Snoozed (snooze)
- Cross-section: Completed → Today (un-complete)
- Cross-section: Snoozed → Tomorrow (un-snooze)
- Cross-section: Completed → Snoozed (should be blocked with toast)
- Cross-section: Snoozed → Completed (should be blocked with toast)
- Collapsed section auto-expand on drag hover
- Mobile touch drag
