"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSun, FaCalendarDay, FaCalendarWeek, FaCheckCircle, FaMoon } from "react-icons/fa";
import { toast } from "sonner";
import { isToday, isTomorrow, isThisWeek, startOfDay, endOfDay, addDays } from "date-fns";
import { DndContext, closestCenter, DragOverlay, MeasuringStrategy } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import TaskItem from "@/components/tasks/TaskItem";
import TaskSection from "@/components/tasks/TaskSection";
import QuickAdd from "@/components/tasks/QuickAdd";
import NextTaskCard from "@/components/dashboard/NextTaskCard";
import StatsOverview from "@/components/dashboard/StatsOverview";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import {
  useDndSensors, computeSortOrders, reorderReminders, patchReminderStatus,
  SECTION_IDS, getSectionTargetDate, getSectionTargetStatus, isStatusChangeNeeded,
  computeNewDateTime, getSectionLabel, getDefaultSnoozeUntil, DROP_ANIMATION_CONFIG,
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
  const [completingIds, setCompletingIds] = useState(new Set());
  const [expandedByDrag, setExpandedByDrag] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const completingTimers = useRef(new Map());
  const expandTimer = useRef(null);
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

  const clearCompletingId = useCallback((id) => {
    clearTimeout(completingTimers.current.get(id));
    completingTimers.current.delete(id);
    setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const handleToggleComplete = async (id, completed) => {
    const previousTasks = tasks;
    // Optimistic update — UI responds instantly (strikethrough + checkbox fill)
    setTasks(prev => prev.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        completed,
        status: completed ? "completed" : "pending",
        completedAt: completed ? new Date().toISOString() : t.completedAt,
        snoozedUntil: completed ? null : t.snoozedUntil,
      };
    }));

    if (completed) {
      // Keep task in original section during animation (1.5s hold)
      setCompletingIds(prev => new Set(prev).add(id));

      const timer = setTimeout(() => {
        completingTimers.current.delete(id);
        setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      }, 1500);
      completingTimers.current.set(id, timer);

      // Undo toast (Todoist-style)
      toast.success("已完成", {
        action: {
          label: "撤銷",
          onClick: () => {
            clearCompletingId(id);
            setTasks(prev => prev.map((t) => {
              if (t.id !== id) return t;
              return { ...t, completed: false, status: "pending" };
            }));
            fetch(`/api/reminders/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ completed: false }),
            }).catch(console.error);
          }
        },
        duration: 3000,
      });
    } else {
      // Un-completing: clear any pending animation, dismiss stale toast
      clearCompletingId(id);
      toast.dismiss();
    }

    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) {
        clearCompletingId(id);
        setTasks(previousTasks);
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      clearCompletingId(id);
      setTasks(previousTasks);
      toast.error("Failed to update task");
    }
  };

  const deleteTimers = useRef(new Map());

  const handleDelete = (id) => {
    const deletedTask = tasks.find((t) => t.id === id);
    if (!deletedTask) return;

    // Close panel if the deleted task is currently selected
    if (id === selectedTaskId) setSelectedTaskId(null);

    // Optimistic remove from UI
    setTasks(prev => prev.filter((t) => t.id !== id));

    // Delayed API call — only delete after undo window expires (5s, Todoist pattern)
    const timer = setTimeout(async () => {
      deleteTimers.current.delete(id);
      try {
        const response = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
        if (!response.ok) {
          setTasks(prev => [...prev, deletedTask]);
          toast.error("刪除失敗");
        }
      } catch (error) {
        console.error("Error deleting task:", error);
        setTasks(prev => [...prev, deletedTask]);
        toast.error("刪除失敗");
      }
    }, 5000);
    deleteTimers.current.set(id, timer);

    toast("已刪除", {
      description: deletedTask.title,
      action: {
        label: "復原",
        onClick: () => {
          clearTimeout(deleteTimers.current.get(id));
          deleteTimers.current.delete(id);
          setTasks(prev => [...prev, deletedTask]);
        }
      },
      duration: 5000,
    });
  };

  const handleUpdate = (updatedTask) => {
    setTasks(tasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
  };

  const handleEditTask = useCallback((taskId) => {
    setSelectedTaskId(taskId);
  }, []);

  const handleSnooze = async (id, snoozedUntil) => {
    const previousTasks = tasks;
    if (snoozedUntil === null) {
      // Optimistic cancel snooze
      setTasks(tasks.map((t) =>
        t.id === id ? { ...t, status: "pending", snoozedUntil: null, completed: false } : t
      ));
      try {
        const response = await fetch(`/api/reminders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        });
        if (response.ok) {
          toast.success("已取消延後");
        } else {
          setTasks(previousTasks);
          toast.error("取消延後失敗");
        }
      } catch (error) {
        console.error("Error canceling snooze:", error);
        setTasks(previousTasks);
        toast.error("取消延後失敗");
      }
    } else {
      // Optimistic snooze
      setTasks(tasks.map((t) =>
        t.id === id ? { ...t, status: "snoozed", snoozedUntil, completed: false } : t
      ));
      try {
        const response = await fetch(`/api/reminders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "snoozed", snoozedUntil }),
        });
        if (response.ok) {
          toast.success("已延後提醒");
        } else {
          setTasks(previousTasks);
          const errData = await response.json();
          toast.error(errData.error || "延後失敗");
        }
      } catch (error) {
        console.error("Error snoozing task:", error);
        setTasks(previousTasks);
        toast.error("延後失敗");
      }
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

  // Tasks in completingIds stay in their original section during the completion animation
  const isPending = (t) => !t.completed || completingIds.has(t.id);

  const todayTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isToday(taskDate) && isPending(t) && t.status !== "snoozed";
    })
  );

  // Find next upcoming task (exclude completing ones)
  const nextTask = todayTasks.find(t => !t.completed && new Date(t.dateTime) > now) || todayTasks.find(t => !t.completed);

  const tomorrowTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isTomorrow(taskDate) && isPending(t) && t.status !== "snoozed";
    })
  );

  const thisWeekTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return (
        isThisWeek(taskDate, { weekStartsOn: 1 }) &&
        !isToday(taskDate) &&
        !isTomorrow(taskDate) &&
        isPending(t) &&
        t.status !== "snoozed"
      );
    })
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
      return taskDate < startOfDay(now) && isPending(t) && t.status !== "snoozed";
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
        clearTimeout(expandTimer.current);
        return;
      }
      // over.id can be a task ID or a section ID
      const section = taskToSection.get(over.id) || over.id;
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
    [taskToSection, expandedByDrag]
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

      const previousTasks = tasks;

      if (sourceSection === targetSection) {
        // Within-section reorder
        const sectionTasks = getSectionTasks(sourceSection);
        const oldIndex = sectionTasks.findIndex((t) => t.id === active.id);
        const newIndex = sectionTasks.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sectionTasks, oldIndex, newIndex);
        // Apply new sortOrder values optimistically so sortByOrder() preserves the new order
        const reorderedWithOrder = reordered.map((task, index) => ({
          ...task,
          sortOrder: (index + 1) * 1000,
        }));
        const reorderedIds = new Set(reorderedWithOrder.map((t) => t.id));
        const otherTasks = tasks.filter((t) => !reorderedIds.has(t.id));
        setTasks([...otherTasks, ...reorderedWithOrder]);

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
    setExpandedByDrag(null);
    clearTimeout(expandTimer.current);
  }, []);

  const activeDragTask = activeDragId ? tasks.find((t) => t.id === activeDragId) : null;
  const activeDragSourceSection = activeDragId ? taskToSection.get(activeDragId) : null;

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
            <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="skeleton-line h-3 w-16 mb-2" />
              <div className="skeleton-line h-6 w-10" />
            </div>
          ))}
        </div>
        {/* Next task card skeleton */}
        <div className="rounded-2xl p-6 mb-8" style={{ background: "linear-gradient(135deg, var(--glass-bg), var(--glass-bg-hover))" }}>
          <div className="skeleton-line h-3 w-20 mb-3" />
          <div className="skeleton-line h-6 w-3/4 mb-2" />
          <div className="skeleton-line h-4 w-1/2" />
        </div>
        {/* Task list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
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
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-text-muted">Focus</h2>
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
        measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
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
            onEdit={handleEditTask}
            accentColor="orange"
            emptyMessage="No overdue tasks"
            sortable
            sectionId={SECTION_IDS.OVERDUE}
            droppable
            isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.OVERDUE && activeDragSourceSection !== SECTION_IDS.OVERDUE}
            completingIds={completingIds}
            forceExpand={expandedByDrag === SECTION_IDS.OVERDUE}
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
          onEdit={handleEditTask}
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
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.TODAY}
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
          onEdit={handleEditTask}
          accentColor="green"
          defaultCollapsed={todayTasks.length > 3}
          emptyMessage="No tasks for tomorrow"
          sortable
          sectionId={SECTION_IDS.TOMORROW}
          droppable
          isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.TOMORROW && activeDragSourceSection !== SECTION_IDS.TOMORROW}
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.TOMORROW}
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
            onEdit={handleEditTask}
            accentColor="purple"
            defaultCollapsed={true}
            sortable
            sectionId={SECTION_IDS.THIS_WEEK}
            droppable
            isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.THIS_WEEK && activeDragSourceSection !== SECTION_IDS.THIS_WEEK}
            completingIds={completingIds}
            forceExpand={expandedByDrag === SECTION_IDS.THIS_WEEK}
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
            onEdit={handleEditTask}
            accentColor="purple"
            defaultCollapsed={!activeDragId && true}
            sortable
            sectionId={SECTION_IDS.SNOOZED}
            droppable
            isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.SNOOZED && activeDragSourceSection !== SECTION_IDS.SNOOZED}
            completingIds={completingIds}
            forceExpand={expandedByDrag === SECTION_IDS.SNOOZED}
          />
        )}

        {/* Completed Today — always visible */}
        <TaskSection
          title="Completed Today"
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
          isExternalDragOver={activeDragId && overSectionId === SECTION_IDS.COMPLETED && activeDragSourceSection !== SECTION_IDS.COMPLETED}
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

      <TaskDetailPanel
        taskId={selectedTaskId}
        tasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onSave={handleUpdate}
      />

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
