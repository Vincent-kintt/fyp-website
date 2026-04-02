"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { FaInbox, FaLightbulb } from "react-icons/fa";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import TaskItem from "@/components/tasks/TaskItem";
import SortableTaskItem from "@/components/tasks/SortableTaskItem";
import EmptyState from "@/components/ui/EmptyState";
import QuickAdd from "@/components/tasks/QuickAdd";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useTasks } from "@/hooks/useTasks";
import {
  useDndSensors,
  computeSortOrders,
  reorderReminders,
  DROP_ANIMATION_CONFIG,
} from "@/lib/dnd";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("inbox");
  const {
    tasks: rawTasks,
    loading,
    toggleComplete,
    deleteTask,
    quickAdd,
    refetch,
  } = useTasks();
  const queryClient = useQueryClient();
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInitialText, setAiInitialText] = useState("");
  const [activeDragId, setActiveDragId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const sensors = useDndSensors();

  const tasks = useMemo(
    () =>
      [...rawTasks].sort((a, b) => {
        const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
        if (orderDiff !== 0) return orderDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }),
    [rawTasks],
  );

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
  const handleEditTask = useCallback((taskId) => {
    setSelectedTaskId(taskId);
  }, []);

  const handleOpenAIFromQuickAdd = (text) => {
    setAiInitialText(text || "");
    setIsAIModalOpen(true);
  };

  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const currentTasks = queryClient.getQueryData(["tasks"]) ?? [];
      const incompleteTasks = currentTasks.filter((t) => !t.completed);
      const oldIndex = incompleteTasks.findIndex((t) => t.id === active.id);
      const newIndex = incompleteTasks.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(incompleteTasks, oldIndex, newIndex);
      const completedTasks = currentTasks.filter((t) => t.completed);

      // Optimistic update
      const previousTasks = currentTasks;
      queryClient.setQueryData(["tasks"], [...reordered, ...completedTasks]);

      // Persist to server
      try {
        const sortUpdates = computeSortOrders(reordered);
        await reorderReminders(sortUpdates);
      } catch {
        queryClient.setQueryData(["tasks"], previousTasks);
        toast.error(t("reorderFailed"));
      }
    },
    [queryClient, t],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const activeDragTask = activeDragId
    ? tasks.find((t) => t.id === activeDragId)
    : null;

  // Separate incomplete and completed tasks
  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  if (status === "loading" || loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <div className="skeleton-line h-7 w-32 mb-2" />
          <div className="skeleton-line h-4 w-56" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="skeleton-line h-12 rounded-lg" />
          <div className="skeleton-line h-12 rounded-lg" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3"
            >
              <div className="skeleton-line w-1 h-10 rounded-full" />
              <div className="skeleton-line w-5 h-5 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-line h-4 w-3/4" />
                <div className="skeleton-line h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold flex items-center gap-3"
          style={{ color: "var(--text-primary)" }}
        >
          <FaInbox className="text-primary" />
          {t("title")}
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <QuickAdd
          onAdd={quickAdd}
          onOpenAI={handleOpenAIFromQuickAdd}
          placeholder={t("quickCapture")}
        />
        <button
          onClick={() => setIsAIModalOpen(true)}
          className="flex items-center justify-center gap-2 p-3 text-accent hover:bg-accent-light rounded-lg transition-colors border-2 border-dashed border-accent/30 hover:border-accent/50"
        >
          <FaLightbulb className="w-4 h-4" />
          <span>{t("aiAssistant")}</span>
        </button>
      </div>

      {/* Task List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={incompleteTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {incompleteTasks.length > 0 ? (
              incompleteTasks.map((task) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  onToggleComplete={toggleComplete}
                  onDelete={(id) => {
                    if (selectedTaskId === id) setSelectedTaskId(null);
                    deleteTask(id);
                  }}
                  onUpdate={refetch}
                  onEdit={handleEditTask}
                />
              ))
            ) : (
              <EmptyState
                icon={<FaInbox className="w-full h-full" />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            )}
          </div>
        </SortableContext>
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

      {/* Completed Section */}
      {completedTasks.length > 0 && (
        <div
          className="mt-8 pt-6"
          style={{ borderTop: "1px solid var(--card-border)" }}
        >
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            {t("completed")} ({completedTasks.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {completedTasks.slice(0, 5).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={toggleComplete}
                onDelete={(id) => {
                  if (selectedTaskId === id) setSelectedTaskId(null);
                  deleteTask(id);
                }}
                onUpdate={refetch}
                onEdit={handleEditTask}
              />
            ))}
            {completedTasks.length > 5 && (
              <p
                className="text-xs py-2 px-4"
                style={{ color: "var(--text-muted)" }}
              >
                {t("moreCompleted", { count: completedTasks.length - 5 })}
              </p>
            )}
          </div>
        </div>
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        tasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onSave={refetch}
      />

      {/* AI Modal */}
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
