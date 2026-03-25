"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSun, FaCalendarDay, FaCalendarWeek, FaCheckCircle, FaMoon } from "react-icons/fa";
import { toast } from "sonner";
import { isToday, isTomorrow, isThisWeek, startOfDay, endOfDay, addDays } from "date-fns";
import { DndContext, closestCenter, DragOverlay, pointerWithin, rectIntersection } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import TaskItem from "@/components/tasks/TaskItem";
import TaskSection from "@/components/tasks/TaskSection";
import QuickAdd from "@/components/tasks/QuickAdd";
import NextTaskCard from "@/components/dashboard/NextTaskCard";
import StatsOverview from "@/components/dashboard/StatsOverview";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import {
  useDndSensors, computeSortOrders, reorderReminders, patchReminderStatus,
  SECTION_IDS, getSectionTargetDate, getSectionTargetStatus, isStatusChangeNeeded,
  computeNewDateTime, getSectionLabel, getDefaultSnoozeUntil,
} from "@/lib/dnd";
import { isValidStatusTransition } from "@/lib/utils";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInitialText, setAiInitialText] = useState("");
  const [activeDragId, setActiveDragId] = useState(null);
  const [overSectionId, setOverSectionId] = useState(null);
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

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/reminders");
      const data = await response.json();
      if (data.success) {
        const now = new Date();
        const processed = data.data.map((r) => {
          if (r.status === "snoozed" && r.snoozedUntil && new Date(r.snoozedUntil) <= now) {
            // Fire-and-forget PATCH to update DB
            fetch(`/api/reminders/${r.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "pending" }),
            }).catch(console.error);
            return { ...r, status: "pending", snoozedUntil: null };
          }
          return r;
        });
        setTasks(processed);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTasks();
    }
  }, [session]);

  const handleToggleComplete = async (id, completed) => {
    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (response.ok) {
        setTasks(tasks.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            completed,
            status: completed ? "completed" : "pending",
            completedAt: completed ? new Date().toISOString() : t.completedAt,
            snoozedUntil: completed ? null : t.snoozedUntil,
          };
        }));
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setTasks(tasks.filter((t) => t.id !== id));
        toast.success("Task deleted");
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleUpdate = (updatedTask) => {
    setTasks(tasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
  };

  const handleSnooze = async (id, snoozedUntil) => {
    try {
      if (snoozedUntil === null) {
        // Cancel snooze
        const response = await fetch(`/api/reminders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        });
        if (response.ok) {
          setTasks(tasks.map((t) =>
            t.id === id ? { ...t, status: "pending", snoozedUntil: null, completed: false } : t
          ));
          toast.success("已取消延後");
        }
      } else {
        const response = await fetch(`/api/reminders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "snoozed", snoozedUntil }),
        });
        if (response.ok) {
          setTasks(tasks.map((t) =>
            t.id === id ? { ...t, status: "snoozed", snoozedUntil, completed: false } : t
          ));
          toast.success("已延後提醒");
        } else {
          const errData = await response.json();
          toast.error(errData.error || "延後失敗");
        }
      }
    } catch (error) {
      console.error("Error snoozing task:", error);
      toast.error("延後失敗");
    }
  };

  const handleQuickAdd = async (taskData) => {
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (response.ok) {
        fetchTasks();
        toast.success("Task added");
      } else {
        toast.error("Failed to add task");
      }
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Failed to add task");
    }
  };

  const handleOpenAIFromQuickAdd = (text) => {
    setAiInitialText(text || "");
    setIsAIModalOpen(true);
  };

  // Build task-to-section mapping for drag logic
  const now = new Date();

  // Sort by dateTime for initial grouping, then re-sort sections by sortOrder
  const sortedTasks = [...tasks].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const sortByOrder = (arr) =>
    arr.sort((a, b) => {
      const oa = a.sortOrder || 0, ob = b.sortOrder || 0;
      if (oa !== ob) return oa - ob;
      return new Date(a.dateTime) - new Date(b.dateTime);
    });

  const todayTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isToday(taskDate) && !t.completed && t.status !== "snoozed";
    })
  );

  // Find next upcoming task
  const nextTask = todayTasks.find(t => new Date(t.dateTime) > now) || todayTasks[0];

  const tomorrowTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isTomorrow(taskDate) && !t.completed && t.status !== "snoozed";
    })
  );

  const thisWeekTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return (
        isThisWeek(taskDate, { weekStartsOn: 1 }) &&
        !isToday(taskDate) &&
        !isTomorrow(taskDate) &&
        !t.completed &&
        t.status !== "snoozed"
      );
    })
  );

  const completedToday = sortedTasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return isToday(taskDate) && t.completed;
  });

  const overdueTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return taskDate < startOfDay(now) && !t.completed && t.status !== "snoozed";
    })
  );

  const snoozedTasks = sortedTasks.filter((t) => t.status === "snoozed" && !t.completed);

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
  }, [overdueTasks, todayTasks, tomorrowTasks, thisWeekTasks, snoozedTasks, completedToday]);

  const getSectionTasks = useCallback(
    (sectionId) => {
      switch (sectionId) {
        case SECTION_IDS.OVERDUE: return overdueTasks;
        case SECTION_IDS.TODAY: return todayTasks;
        case SECTION_IDS.TOMORROW: return tomorrowTasks;
        case SECTION_IDS.THIS_WEEK: return thisWeekTasks;
        case SECTION_IDS.SNOOZED: return snoozedTasks;
        case SECTION_IDS.COMPLETED: return completedToday;
        default: return [];
      }
    },
    [overdueTasks, todayTasks, tomorrowTasks, thisWeekTasks, snoozedTasks, completedToday]
  );

  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragOver = useCallback(
    (event) => {
      const { over } = event;
      if (!over) {
        setOverSectionId(null);
        return;
      }
      // over.id can be a task ID or a section ID
      const section = taskToSection.get(over.id) || over.id;
      setOverSectionId(section);
    },
    [taskToSection]
  );

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveDragId(null);
      setOverSectionId(null);

      if (!over || active.id === over.id) return;

      const sourceSection = taskToSection.get(active.id);
      const rawTarget = taskToSection.get(over.id) || over.id;
      const validSections = new Set(Object.values(SECTION_IDS));
      const targetSection = validSections.has(rawTarget) ? rawTarget : null;

      if (!sourceSection || !targetSection) return;

      const previousTasks = tasks;

      if (sourceSection === targetSection) {
        // Within-section reorder
        const sectionTasks = getSectionTasks(sourceSection);
        const oldIndex = sectionTasks.findIndex((t) => t.id === active.id);
        const newIndex = sectionTasks.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sectionTasks, oldIndex, newIndex);
        const reorderedIds = new Set(reordered.map((t) => t.id));
        const otherTasks = tasks.filter((t) => !reorderedIds.has(t.id));
        setTasks([...otherTasks, ...reordered]);

        try {
          const sortUpdates = computeSortOrders(reordered);
          await reorderReminders(sortUpdates);
        } catch {
          setTasks(previousTasks);
          toast.error("Failed to reorder");
        }
      } else {
        // Cross-section drag — handle status + date changes
        const draggedTask = tasks.find((t) => t.id === active.id);
        if (!draggedTask) return;

        const needsStatus = isStatusChangeNeeded(sourceSection, targetSection);
        const targetStatus = getSectionTargetStatus(targetSection);
        const targetDate = getSectionTargetDate(targetSection);

        // Validate status transition before any optimistic update
        if (needsStatus) {
          const currentStatus = draggedTask.status || "pending";
          if (!isValidStatusTransition(currentStatus, targetStatus.status)) {
            toast.error("無法執行此操作");
            return;
          }
        }

        // Build optimistic update
        const optimistic = { ...draggedTask };

        if (needsStatus) {
          optimistic.status = targetStatus.status;
          if (targetStatus.completed !== undefined) {
            optimistic.completed = targetStatus.completed;
          }
          if (targetStatus.status === "completed") {
            optimistic.completedAt = new Date().toISOString();
            optimistic.snoozedUntil = null;
          }
          if (targetStatus.status === "snoozed") {
            optimistic.snoozedUntil = getDefaultSnoozeUntil();
            optimistic.completed = false;
          }
          if (targetStatus.status === "pending") {
            optimistic.snoozedUntil = null;
            optimistic.completed = false;
          }
        }

        if (targetDate) {
          optimistic.dateTime = computeNewDateTime(draggedTask.dateTime, targetDate);
        }

        setTasks(tasks.map((t) => (t.id === active.id ? optimistic : t)));

        try {
          if (needsStatus) {
            // Use PATCH for status changes (handles all fields in one call)
            const patchBody = { status: targetStatus.status };
            if (targetStatus.status === "completed") {
              patchBody.completed = true;
            } else if (targetStatus.status === "pending") {
              patchBody.completed = false;
            }
            if (targetStatus.status === "snoozed") {
              patchBody.snoozedUntil = optimistic.snoozedUntil;
            }
            if (targetDate) {
              patchBody.dateTime = optimistic.dateTime;
            }
            await patchReminderStatus(active.id, patchBody);
          } else {
            // Date-only move — use reorder API
            await reorderReminders([{
              id: active.id,
              sortOrder: draggedTask.sortOrder || 0,
              dateTime: optimistic.dateTime,
            }]);
          }
          toast.success(`已移至${getSectionLabel(targetSection)}`);
        } catch {
          setTasks(previousTasks);
          toast.error("移動失敗");
        }
      }
    },
    [tasks, taskToSection, getSectionTasks]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverSectionId(null);
  }, []);

  const activeDragTask = activeDragId ? tasks.find((t) => t.id === activeDragId) : null;
  const activeDragSourceSection = activeDragId ? taskToSection.get(activeDragId) : null;

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your day...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <FaSun className="text-yellow-500" />
          Today
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats Overview */}
      <StatsOverview tasks={todayTasks.concat(completedToday)} />

      {/* Next Task Card (Hero) */}
      {nextTask && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-500 dark:text-gray-400">Focus</h2>
          <NextTaskCard task={nextTask} onComplete={handleToggleComplete} />
        </div>
      )}

      {/* Quick Add */}
      <div className="mb-8">
        <QuickAdd 
          onAdd={handleQuickAdd} 
          onOpenAI={handleOpenAIFromQuickAdd}
          placeholder="What do you need to do today?" 
        />
      </div>

      {/* Drag-and-Drop Context for all sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Overdue Tasks */}
        {(overdueTasks.length > 0 || activeDragId) && (
          <TaskSection
            title="Overdue"
            icon={<FaCalendarDay />}
            tasks={overdueTasks}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onSnooze={handleSnooze}
            accentColor="orange"
            emptyMessage="No overdue tasks"
            sortable
            sectionId={SECTION_IDS.OVERDUE}
            droppable
            isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.OVERDUE && activeDragSourceSection !== SECTION_IDS.OVERDUE}
          />
        )}

        {/* Today's Tasks */}
        <TaskSection
          title="Today"
          icon={<FaSun />}
          tasks={todayTasks}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onSnooze={handleSnooze}
          accentColor="blue"
          showDate={false}
          emptyMessage="No tasks for today."
          emptyAction={{
            text: "Plan my day with AI",
            subtext: "Let AI organize your schedule",
            onClick: () => setIsAIModalOpen(true)
          }}
          sortable
          sectionId={SECTION_IDS.TODAY}
          droppable
          isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.TODAY && activeDragSourceSection !== SECTION_IDS.TODAY}
        />

        {/* Tomorrow's Tasks */}
        <TaskSection
          title="Tomorrow"
          icon={<FaCalendarDay />}
          tasks={tomorrowTasks}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onSnooze={handleSnooze}
          accentColor="green"
          defaultCollapsed={todayTasks.length > 3}
          emptyMessage="No tasks for tomorrow"
          sortable
          sectionId={SECTION_IDS.TOMORROW}
          droppable
          isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.TOMORROW && activeDragSourceSection !== SECTION_IDS.TOMORROW}
        />

        {/* This Week */}
        {(thisWeekTasks.length > 0 || activeDragId) && (
          <TaskSection
            title="This Week"
            icon={<FaCalendarWeek />}
            tasks={thisWeekTasks}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onSnooze={handleSnooze}
            accentColor="purple"
            defaultCollapsed={true}
            sortable
            sectionId={SECTION_IDS.THIS_WEEK}
            droppable
            isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.THIS_WEEK && activeDragSourceSection !== SECTION_IDS.THIS_WEEK}
          />
        )}

        {/* Snoozed Tasks */}
        {(snoozedTasks.length > 0 || activeDragId) && (
          <TaskSection
            title="已延後"
            icon={<FaMoon />}
            tasks={snoozedTasks}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onSnooze={handleSnooze}
            accentColor="purple"
            defaultCollapsed={!activeDragId && true}
            sortable
            sectionId={SECTION_IDS.SNOOZED}
            droppable
            isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.SNOOZED && activeDragSourceSection !== SECTION_IDS.SNOOZED}
          />
        )}

        {/* Completed Today */}
        {(completedToday.length > 0 || activeDragId) && (
          <TaskSection
            title="Completed Today"
            icon={<FaCheckCircle />}
            tasks={completedToday}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onSnooze={handleSnooze}
            accentColor="gray"
            defaultCollapsed={!activeDragId && true}
            showDate={false}
            sortable
            sectionId={SECTION_IDS.COMPLETED}
            droppable
            isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.COMPLETED && activeDragSourceSection !== SECTION_IDS.COMPLETED}
          />
        )}

        <DragOverlay>
          {activeDragTask ? (
            <TaskItem
              task={activeDragTask}
              onToggleComplete={() => {}}
              onDelete={() => {}}
              onUpdate={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <FloatingActionButton onClick={() => setIsAIModalOpen(true)} />
      
      <AIReminderModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          setAiInitialText("");
        }}
        onSuccess={fetchTasks}
        initialText={aiInitialText}
      />
    </div>
  );
}
