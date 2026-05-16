"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSections } from "@/hooks/useTaskSections";
import { useTaskDnD } from "@/hooks/useTaskDnD";
import TaskItem from "@/components/tasks/TaskItem";
import TaskSection from "@/components/tasks/TaskSection";
import QuickAdd from "@/components/tasks/QuickAdd";
import NextTaskCard from "@/components/dashboard/NextTaskCard";
import StatsOverview from "@/components/dashboard/StatsOverview";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useAIModal } from "@/components/ai/AIModalProvider";
import {
  SECTION_IDS,
  DROP_ANIMATION_CONFIG,
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
  const aiModal = useAIModal();
  const [completingIds, setCompletingIds] = useState(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const completingTimers = useRef(new Map());

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

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
    aiModal.open(text || "");
  };

  const {
    overdueTasks,
    todayTasks,
    tomorrowTasks,
    thisWeekTasks,
    snoozedTasks,
    completedToday,
    nextTask,
    taskToSection,
    getSectionTasks,
  } = useTaskSections({ tasks, completingIds });

  const {
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
  } = useTaskDnD({ tasks, taskToSection, getSectionTasks, queryClient, t });

  if (status === "loading" || loading) {
    return <DashboardSkeleton />;
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
            onClick: () => aiModal.open(),
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

    </div>
  );
}
