"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  useDndSensors,
  createSectionAwareCollision,
  SECTION_IDS,
  computeSortOrders,
  reorderReminders as defaultReorderReminders,
  patchReminderStatus as defaultPatchReminderStatus,
  getSectionTargetDate,
  getSectionTargetStatus,
  getDefaultSnoozeUntil,
  computeNewDateTime,
  getSectionLabelKey,
} from "@/lib/dnd.js";
import { arrayMove } from "@dnd-kit/sortable";
import { reminderKeys } from "@/lib/queryKeys";

/**
 * Pure async drag-end executor with all side effects injected.
 * Mirrors the inline handleDragEnd from dashboard/page.js bf5e996 exactly.
 *
 * @param {object} params
 * @param {DragEndEvent} params.event - dnd-kit drag end event
 * @param {Array} params.tasks - current task list
 * @param {Map} params.taskToSection - taskId → sectionId map
 * @param {(sectionId: string) => Array} params.getSectionTasks - tasks per section
 * @param {object} params.queryClient - react-query client (getQueryData/setQueryData)
 * @param {(items) => Promise} [params.reorderReminders] - injected for tests (default: lib/dnd export)
 * @param {(id, body) => Promise} [params.patchReminderStatus] - injected for tests (default: lib/dnd export)
 * @param {object} params.toast - { error, success, warning } from sonner (injected for tests)
 * @param {(key) => string} params.t - i18n translation function
 */
export async function executeDragEnd({
  event,
  tasks,
  taskToSection,
  getSectionTasks,
  queryClient,
  reorderReminders = defaultReorderReminders,
  patchReminderStatus = defaultPatchReminderStatus,
  toast,
  t,
}) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const sourceSection = taskToSection.get(active.id);
  const rawTarget = taskToSection.get(over.id) || over.id;
  const validSections = new Set(Object.values(SECTION_IDS));
  const targetSection = validSections.has(rawTarget) ? rawTarget : null;

  if (!sourceSection || !targetSection) return;

  const originalTasks = queryClient.getQueryData(reminderKeys.list({}));

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
      reminderKeys.list({}),
      [...otherTasks, ...reorderedWithOrder],
    );

    try {
      const sortUpdates = computeSortOrders(reordered);
      await reorderReminders(sortUpdates);
    } catch {
      queryClient.setQueryData(reminderKeys.list({}), originalTasks);
      toast.error(t("reorderFailed"));
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

    // Block drag TO Overdue — it's a computed state, not a drop target
    if (targetSection === SECTION_IDS.OVERDUE) return;

    // Block invalid transitions: COMPLETED ↔ SNOOZED
    if (isFromStatus && isToStatus) {
      toast.warning(t("restoreFirst"));
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
        reminderKeys.list({}),
        tasks.map((t) => (t.id === active.id ? optimisticUpdate : t)),
      );

      try {
        await patchReminderStatus(active.id, statusBody);
        toast.success(t("movedTo", { section: t(getSectionLabelKey(targetSection)) }));
      } catch {
        queryClient.setQueryData(reminderKeys.list({}), originalTasks);
        toast.error(t("moveFailed"));
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
          reminderKeys.list({}),
          tasks.map((t) => (t.id === active.id ? optimisticUpdate : t)),
        );

        try {
          await patchReminderStatus(active.id, statusBody);
          toast.success(t("movedTo", { section: t(getSectionLabelKey(targetSection)) }));
        } catch {
          queryClient.setQueryData(reminderKeys.list({}), originalTasks);
          toast.error(t("moveFailed"));
        }
      } else {
        // Date → Date move (existing logic)
        queryClient.setQueryData(
          reminderKeys.list({}),
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
          toast.success(t("movedTo", { section: t(getSectionLabelKey(targetSection)) }));
        } catch {
          queryClient.setQueryData(reminderKeys.list({}), originalTasks);
          toast.error(t("moveFailed"));
        }
      }
    }
  }
}

export function useTaskDnD({ tasks, taskToSection, getSectionTasks, queryClient, t }) {
  // UI drag state
  const [activeDragId, setActiveDragId] = useState(null);
  const [overSectionId, setOverSectionId] = useState(null);
  const [expandedByDrag, setExpandedByDrag] = useState(null);

  // Refs
  const expandTimer = useRef(null);
  const taskToSectionRef = useRef(new Map());

  // Sync ref with latest map (used by collision detection outside render cycle)
  useEffect(() => {
    taskToSectionRef.current = taskToSection;
  }, [taskToSection]);

  // Sensors
  const sensors = useDndSensors();

  // Collision detection — ref identity never changes, memo deps empty by design
  const collisionDetection = useMemo(
    () => createSectionAwareCollision(taskToSectionRef),
    [],
  );

  // Reset helper — idempotent
  const resetDragState = useCallback(() => {
    setActiveDragId(null);
    setOverSectionId(null);
    setExpandedByDrag(null);
    clearTimeout(expandTimer.current);
  }, []);

  // handleDragStart
  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  // handleDragOver — preserve EXACT inline behavior including 500ms autoexpand
  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) {
        setOverSectionId(null);
        clearTimeout(expandTimer.current);
        return;
      }
      const section = taskToSection.get(over.id) || over.id;

      // Suppress overlay on Overdue for cross-section drags
      const activeSection = taskToSection.get(active.id);
      if (
        section === SECTION_IDS.OVERDUE &&
        activeSection !== SECTION_IDS.OVERDUE
      ) {
        setOverSectionId(null);
        clearTimeout(expandTimer.current);
        return;
      }

      setOverSectionId(section);

      // Auto-expand collapsed sections after 500ms hover
      if (section !== expandedByDrag) {
        clearTimeout(expandTimer.current);
        const validSections = new Set(Object.values(SECTION_IDS));
        if (validSections.has(section)) {
          expandTimer.current = setTimeout(() => {
            setExpandedByDrag(section);
          }, 500);
        }
      }
    },
    [taskToSection, expandedByDrag],
  );

  // handleDragCancel
  const handleDragCancel = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  // handleDragEnd — wrapper that resets drag state then delegates to executeDragEnd
  const handleDragEnd = useCallback(
    async (event) => {
      resetDragState();
      await executeDragEnd({
        event,
        tasks,
        taskToSection,
        getSectionTasks,
        queryClient,
        toast,
        t,
      });
    },
    [tasks, taskToSection, getSectionTasks, queryClient, t, resetDragState],
  );

  // Derived state
  const activeDragTask = activeDragId
    ? tasks.find((t) => t.id === activeDragId)
    : null;
  const activeDragSourceSection = activeDragId
    ? taskToSection.get(activeDragId)
    : null;

  return {
    sensors,
    collisionDetection,
    activeDragId,
    overSectionId,
    expandedByDrag,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    activeDragTask,
    activeDragSourceSection,
  };
}
