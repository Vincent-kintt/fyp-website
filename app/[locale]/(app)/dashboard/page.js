"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  FaSun,
  FaCalendarDay,
  FaCalendarWeek,
  FaCheckCircle,
  FaMoon,
} from "react-icons/fa";
import { toast } from "sonner";
import { isToday, isTomorrow, isThisWeek, startOfDay } from "date-fns";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { useTasks } from "@/hooks/useTasks";
import TaskItem from "@/components/tasks/TaskItem";
import TaskSection from "@/components/tasks/TaskSection";
import QuickAdd from "@/components/tasks/QuickAdd";
import NextTaskCard from "@/components/dashboard/NextTaskCard";
import StatsOverview from "@/components/dashboard/StatsOverview";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
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
  getSectionLabelKey,
  DROP_ANIMATION_CONFIG,
  createSectionAwareCollision,
} from "@/lib/dnd";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const locale = useLocale();
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
  const tasks = rawTasks;
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInitialText, setAiInitialText] = useState("");
  const [activeDragId, setActiveDragId] = useState(null);
  const [overSectionId, setOverSectionId] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const [expandedByDrag, setExpandedByDrag] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const completingTimers = useRef(new Map());
  const expandTimer = useRef(null);
  // Ref for collision detection (runs outside React render cycle)
  const taskToSectionRef = useRef(new Map());
  const sensors = useDndSensors();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Listen for open-ai-modal event from GlobalSearch quick actions
  useEffect(() => {
    const handler = () => setIsAIModalOpen(true);
    window.addEventListener("open-ai-modal", handler);
    return () => window.removeEventListener("open-ai-modal", handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsAIModalOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
  const clearCompletingId = useCallback((id) => {
    clearTimeout(completingTimers.current.get(id));
    completingTimers.current.delete(id);
    setCompletingIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }, []);

  const handleToggleComplete = useCallback(
    async (id, completed) => {
      if (completed) {
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
        clearCompletingId(id);
      }
      try {
        await toggleComplete(id, completed);
      } catch {
        clearCompletingId(id);
      }
    },
    [toggleComplete, clearCompletingId],
  );

  const handleDelete = useCallback(
    (id) => {
      if (selectedTaskId === id) setSelectedTaskId(null);
      deleteTask(id);
    },
    [deleteTask, selectedTaskId],
  );

  const handleUpdate = useCallback(() => refetch(), [refetch]);

  const handleEditTask = useCallback((taskId) => {
    setSelectedTaskId(taskId);
  }, []);

  const handleSnooze = useCallback(
    (id, snoozedUntil) => {
      snoozeTask(id, snoozedUntil);
    },
    [snoozeTask],
  );

  const handleQuickAdd = useCallback(
    (data) => {
      quickAdd(data);
    },
    [quickAdd],
  );

  const handleOpenAIFromQuickAdd = (text) => {
    setAiInitialText(text || "");
    setIsAIModalOpen(true);
  };

  // Build task-to-section mapping for drag logic
  const now = new Date();

  // Sort by dateTime for initial grouping, then re-sort sections by sortOrder
  // Tasks without dateTime (inbox tasks) are excluded from date-based sections
  const datedTasks = tasks.filter((t) => t.dateTime);
  const sortedTasks = [...datedTasks].sort(
    (a, b) => new Date(a.dateTime) - new Date(b.dateTime),
  );

  const sortByOrder = (arr) =>
    arr.sort((a, b) => {
      const oa = a.sortOrder || 0,
        ob = b.sortOrder || 0;
      if (oa !== ob) return oa - ob;
      return new Date(a.dateTime) - new Date(b.dateTime);
    });

  // Tasks in completingIds stay in their original section during the completion animation
  const isPending = (t) => !t.completed || completingIds.has(t.id);

  const todayTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isToday(taskDate) && isPending(t) && t.status !== "snoozed";
    }),
  );

  // Find next upcoming task (exclude completing ones)
  const nextTask =
    todayTasks.find((t) => !t.completed && new Date(t.dateTime) > now) ||
    todayTasks.find((t) => !t.completed);

  const tomorrowTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isTomorrow(taskDate) && isPending(t) && t.status !== "snoozed";
    }),
  );

  const thisWeekTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return (
        isThisWeek(taskDate, { weekStartsOn: 1 }) &&
        taskDate >= startOfDay(now) &&
        !isToday(taskDate) &&
        !isTomorrow(taskDate) &&
        isPending(t) &&
        t.status !== "snoozed"
      );
    }),
  );

  // Completed today: tasks completed today (by completedAt), excluding those still animating
  const completedToday = sortedTasks.filter((t) => {
    if (!t.completed || completingIds.has(t.id)) return false;
    const completedDate = t.completedAt ? new Date(t.completedAt) : null;
    const taskDate = new Date(t.dateTime);
    return isToday(taskDate) || (completedDate && isToday(completedDate));
  });

  const overdueTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return (
        taskDate < startOfDay(now) && isPending(t) && t.status !== "snoozed"
      );
    }),
  );

  const snoozedTasks = sortedTasks.filter(
    (t) => t.status === "snoozed" && !t.completed,
  );

  // Map taskId -> sectionId for drag logic
  const taskToSection = useMemo(() => {
    const map = new Map();
    overdueTasks.forEach((t) => map.set(t.id, SECTION_IDS.OVERDUE));
    todayTasks.forEach((t) => map.set(t.id, SECTION_IDS.TODAY));
    tomorrowTasks.forEach((t) => map.set(t.id, SECTION_IDS.TOMORROW));
    thisWeekTasks.forEach((t) => map.set(t.id, SECTION_IDS.THIS_WEEK));
    snoozedTasks.forEach((t) => map.set(t.id, SECTION_IDS.SNOOZED));
    completedToday.forEach((t) => map.set(t.id, SECTION_IDS.COMPLETED));
    return map;
  }, [
    overdueTasks,
    todayTasks,
    tomorrowTasks,
    thisWeekTasks,
    snoozedTasks,
    completedToday,
  ]);

  // Keep ref in sync for collision detection
  useEffect(() => {
    taskToSectionRef.current = taskToSection;
  }, [taskToSection]);

  // Stable collision detection — ref identity never changes
  const collisionDetection = useMemo(
    () => createSectionAwareCollision(taskToSectionRef),
    [],
  );

  const getSectionTasks = useCallback(
    (sectionId) => {
      switch (sectionId) {
        case SECTION_IDS.OVERDUE:
          return overdueTasks;
        case SECTION_IDS.TODAY:
          return todayTasks;
        case SECTION_IDS.TOMORROW:
          return tomorrowTasks;
        case SECTION_IDS.THIS_WEEK:
          return thisWeekTasks;
        case SECTION_IDS.SNOOZED:
          return snoozedTasks;
        case SECTION_IDS.COMPLETED:
          return completedToday;
        default:
          return [];
      }
    },
    [
      overdueTasks,
      todayTasks,
      tomorrowTasks,
      thisWeekTasks,
      snoozedTasks,
      completedToday,
    ],
  );

  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) {
        setOverSectionId(null);
        clearTimeout(expandTimer.current);
        return;
      }
      // over.id can be a task ID or a section ID
      const section = taskToSection.get(over.id) || over.id;

      // Suppress overlay on Overdue for cross-section drags (Overdue is not a drop target)
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

      // Auto-expand collapsed sections after 500ms hover (industry standard)
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
            ["tasks"],
            tasks.map((t) => (t.id === active.id ? optimisticUpdate : t)),
          );

          try {
            await patchReminderStatus(active.id, statusBody);
            toast.success(t("movedTo", { section: t(getSectionLabelKey(targetSection)) }));
          } catch {
            queryClient.setQueryData(["tasks"], originalTasks);
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
              ["tasks"],
              tasks.map((t) => (t.id === active.id ? optimisticUpdate : t)),
            );

            try {
              await patchReminderStatus(active.id, statusBody);
              toast.success(t("movedTo", { section: t(getSectionLabelKey(targetSection)) }));
            } catch {
              queryClient.setQueryData(["tasks"], originalTasks);
              toast.error(t("moveFailed"));
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
              toast.success(t("movedTo", { section: t(getSectionLabelKey(targetSection)) }));
            } catch {
              queryClient.setQueryData(["tasks"], originalTasks);
              toast.error(t("moveFailed"));
            }
          }
        }
      }
    },
    [tasks, taskToSection, getSectionTasks, queryClient, t],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverSectionId(null);
    setExpandedByDrag(null);
    clearTimeout(expandTimer.current);
  }, []);

  const activeDragTask = activeDragId
    ? tasks.find((t) => t.id === activeDragId)
    : null;
  const activeDragSourceSection = activeDragId
    ? taskToSection.get(activeDragId)
    : null;

  if (status === "loading" || loading) {
    return (
      <div className="max-w-2xl mx-auto pb-24">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="skeleton-line h-7 w-32 mb-2" />
          <div className="skeleton-line h-4 w-48" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-4"
              style={{
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="skeleton-line h-3 w-16 mb-2" />
              <div className="skeleton-line h-6 w-10" />
            </div>
          ))}
        </div>
        {/* Next task card skeleton */}
        <div
          className="rounded-2xl p-6 mb-8"
          style={{
            background:
              "linear-gradient(135deg, var(--glass-bg), var(--glass-bg-hover))",
          }}
        >
          <div className="skeleton-line h-3 w-20 mb-3" />
          <div className="skeleton-line h-6 w-3/4 mb-2" />
          <div className="skeleton-line h-4 w-1/2" />
        </div>
        {/* Task list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="skeleton-line w-5 h-5 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="skeleton-line h-4 w-3/4 mb-2" />
                <div className="skeleton-line h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="page-enter-1" style={{ marginBottom: "var(--spacing-section)" }}>
        <h1
          className="text-2xl font-bold flex items-center gap-3"
          style={{ color: "var(--text-primary)" }}
        >
          <FaSun className="text-yellow-500" />
          {t("title")}
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {new Date().toLocaleDateString(locale === "zh-TW" ? "zh-TW" : "en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="page-enter-2">
        <StatsOverview tasks={overdueTasks.concat(todayTasks, completedToday)} />
      </div>

      {/* Next Task Card (Hero) */}
      {nextTask && (
        <div className="page-enter-3" style={{ marginBottom: "var(--spacing-section)" }}>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-text-muted">
            {t("focus")}
          </h2>
          <NextTaskCard task={nextTask} onComplete={handleToggleComplete} />
        </div>
      )}

      {/* Quick Add */}
      <div className="page-enter-4" style={{ marginBottom: "var(--spacing-section)" }}>
        <QuickAdd
          onAdd={handleQuickAdd}
          onOpenAI={handleOpenAIFromQuickAdd}
          placeholder={t("quickAddPlaceholder")}
        />
      </div>

      {/* Drag-and-Drop Context for all sections */}
      <div className="page-enter-5">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Overdue Tasks */}
        {(overdueTasks.length > 0 || activeDragId) && (
          <TaskSection
            title={t("overdue")}
            icon={<FaCalendarDay />}
            tasks={overdueTasks}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onSnooze={handleSnooze}
            onEdit={handleEditTask}
            accentColor="orange"
            emptyMessage={t("noOverdue")}
            sortable
            sectionId={SECTION_IDS.OVERDUE}
            droppable
            isExternalDragOver={
              activeDragId &&
              overSectionId === SECTION_IDS.OVERDUE &&
              activeDragSourceSection !== SECTION_IDS.OVERDUE
            }
            completingIds={completingIds}
            forceExpand={expandedByDrag === SECTION_IDS.OVERDUE}
          />
        )}

        {/* Today's Tasks */}
        <TaskSection
          title={t("todaySection")}
          icon={<FaSun />}
          tasks={todayTasks}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onSnooze={handleSnooze}
          onEdit={handleEditTask}
          accentColor="blue"
          showDate={false}
          emptyMessage={t("noToday")}
          emptyAction={{
            text: t("planWithAI"),
            subtext: t("planWithAISubtext"),
            onClick: () => setIsAIModalOpen(true),
          }}
          sortable
          sectionId={SECTION_IDS.TODAY}
          droppable
          isExternalDragOver={
            activeDragId &&
            overSectionId === SECTION_IDS.TODAY &&
            activeDragSourceSection !== SECTION_IDS.TODAY
          }
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.TODAY}
        />

        {/* Tomorrow's Tasks */}
        <TaskSection
          title={t("tomorrow")}
          icon={<FaCalendarDay />}
          tasks={tomorrowTasks}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onSnooze={handleSnooze}
          onEdit={handleEditTask}
          accentColor="green"
          defaultCollapsed={todayTasks.length > 3}
          emptyMessage={t("noTomorrow")}
          sortable
          sectionId={SECTION_IDS.TOMORROW}
          droppable
          isExternalDragOver={
            activeDragId &&
            overSectionId === SECTION_IDS.TOMORROW &&
            activeDragSourceSection !== SECTION_IDS.TOMORROW
          }
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.TOMORROW}
        />

        {/* This Week */}
        {(thisWeekTasks.length > 0 || activeDragId) && (
          <TaskSection
            title={t("thisWeek")}
            icon={<FaCalendarWeek />}
            tasks={thisWeekTasks}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onSnooze={handleSnooze}
            onEdit={handleEditTask}
            accentColor="purple"
            defaultCollapsed={true}
            sortable
            sectionId={SECTION_IDS.THIS_WEEK}
            droppable
            isExternalDragOver={
              activeDragId &&
              overSectionId === SECTION_IDS.THIS_WEEK &&
              activeDragSourceSection !== SECTION_IDS.THIS_WEEK
            }
            completingIds={completingIds}
            forceExpand={expandedByDrag === SECTION_IDS.THIS_WEEK}
          />
        )}

        {/* Snoozed Tasks */}
        {(snoozedTasks.length > 0 || activeDragId) && (
          <TaskSection
            title={t("snoozed")}
            icon={<FaMoon />}
            tasks={snoozedTasks}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onSnooze={handleSnooze}
            onEdit={handleEditTask}
            accentColor="purple"
            defaultCollapsed={!activeDragId && true}
            sortable
            sectionId={SECTION_IDS.SNOOZED}
            droppable
            isExternalDragOver={
              activeDragId &&
              overSectionId === SECTION_IDS.SNOOZED &&
              activeDragSourceSection !== SECTION_IDS.SNOOZED
            }
            completingIds={completingIds}
            forceExpand={expandedByDrag === SECTION_IDS.SNOOZED}
          />
        )}

        {/* Completed Today — always visible */}
        <TaskSection
          title={t("completedToday")}
          icon={<FaCheckCircle />}
          tasks={completedToday}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onSnooze={handleSnooze}
          onEdit={handleEditTask}
          accentColor="gray"
          defaultCollapsed={false}
          showDate={false}
          sortable
          sectionId={SECTION_IDS.COMPLETED}
          droppable
          isExternalDragOver={
            activeDragId &&
            overSectionId === SECTION_IDS.COMPLETED &&
            activeDragSourceSection !== SECTION_IDS.COMPLETED
          }
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.COMPLETED}
        />

        <DragOverlay dropAnimation={DROP_ANIMATION_CONFIG}>
          {activeDragTask ? (
            <TaskItem
              task={activeDragTask}
              onToggleComplete={() => {}}
              onDelete={() => {}}
              onUpdate={() => {}}
              onEdit={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>

      <TaskDetailPanel
        taskId={selectedTaskId}
        tasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onSave={handleUpdate}
      />

      <AIReminderModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          setAiInitialText("");
        }}
        onSuccess={() => refetch()}
        initialText={aiInitialText}
      />
    </div>
  );
}
