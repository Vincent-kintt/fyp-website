"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { FaSun } from "react-icons/fa";
import { useQueryClient } from "@tanstack/react-query";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSections } from "@/hooks/useTaskSections";
import { useTaskDnD } from "@/hooks/useTaskDnD";
import QuickAdd from "@/components/tasks/QuickAdd";
import NextTaskCard from "@/components/dashboard/NextTaskCard";
import SectionList from "@/components/dashboard/SectionList";
import StatsOverview from "@/components/dashboard/StatsOverview";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useAIModal } from "@/components/ai/AIModalProvider";

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const {
    tasks,
    loading,
    toggleComplete,
    deleteTask,
    snoozeTask,
    quickAdd,
    refetch,
  } = useTasks();
  const queryClient = useQueryClient();
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
    (data) => quickAdd(data),
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
        <StatsOverview
          completedCount={completedToday.length}
          pendingCount={overdueTasks.length + todayTasks.length}
          overdueCount={overdueTasks.length}
        />
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
        <SectionList
          sections={{
            overdueTasks, todayTasks, tomorrowTasks, thisWeekTasks, snoozedTasks, completedToday,
          }}
          taskHandlers={{
            onToggleComplete: handleToggleComplete,
            onDelete: handleDelete,
            onUpdate: handleUpdate,
            onSnooze: handleSnooze,
            onEdit: handleEditTask,
          }}
          dragHandlers={{
            sensors,
            collisionDetection,
            onDragStart: handleDragStart,
            onDragOver: handleDragOver,
            onDragEnd: handleDragEnd,
            onDragCancel: handleDragCancel,
          }}
          dragState={{
            activeDragId, overSectionId, expandedByDrag, activeDragTask, activeDragSourceSection,
          }}
          completingIds={completingIds}
          onPlanWithAI={() => aiModal.open()}
          t={t}
        />
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
