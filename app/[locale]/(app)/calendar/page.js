"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTasks } from "@/hooks/useTasks";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useDndSensors,
  DROP_ANIMATION_CONFIG,
  computeNewDateTime,
  patchReminderStatus,
  CALENDAR_DAY_PREFIX,
  parseDayDropId,
} from "@/lib/dnd";
import DayTimeline from "@/components/calendar/DayTimeline";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("calendar");
  const { tasks, loading, toggleComplete, deleteTask, refetch } = useTasks();

  // Initialize with null to prevent hydration mismatch
  const [currentMonth, setCurrentMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('month');
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const handleEditTask = useCallback((taskId) => {
    setSelectedTaskId(taskId);
  }, []);

  const sensors = useDndSensors();
  const queryClient = useQueryClient();
  const [activeDragId, setActiveDragId] = useState(null);

  const handleCalendarDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleCalendarDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveDragId(null);

      if (!over) return;

      const targetDate = parseDayDropId(over.id);
      if (!targetDate) return;

      const draggedTask = tasks.find((t) => t.id === active.id);
      if (!draggedTask) return;

      // Skip if dropping on same day
      if (isSameDay(new Date(draggedTask.dateTime), targetDate)) return;

      const newDateTime = computeNewDateTime(draggedTask.dateTime, targetDate);

      // Optimistic update
      const originalTasks = queryClient.getQueryData(["tasks"]);
      queryClient.setQueryData(
        ["tasks"],
        tasks.map((t) =>
          t.id === active.id ? { ...t, dateTime: newDateTime } : t
        )
      );

      try {
        await patchReminderStatus(active.id, { dateTime: newDateTime });
        toast.success(t("movedTo", { date: format(targetDate, "M/d") }));
      } catch {
        queryClient.setQueryData(["tasks"], originalTasks);
        toast.error(t("moveFailed"));
      }
    },
    [tasks, queryClient, t]
  );

  const handleCalendarDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const activeDragTask = activeDragId
    ? tasks.find((t) => t.id === activeDragId)
    : null;

  useEffect(() => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Get tasks for a specific date
  const getTasksForDate = (date) => {
    if (!date) return [];
    return tasks.filter((task) => isSameDay(new Date(task.dateTime), date));
  };

  // Get tasks for selected date
  const selectedDateTasks = getTasksForDate(selectedDate);

  // Calendar rendering
  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:opacity-70 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:opacity-70 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <FaChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = [t("days.sun"), t("days.mon"), t("days.tue"), t("days.wed"), t("days.thu"), t("days.fri"), t("days.sat")];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium py-2"
            style={{ color: "var(--text-muted)" }}
          >
            {day}
          </div>
        ))}
      </div>
    );
  };

  function DroppableDay({ dateStr, isCurrentMonth, children }) {
    const { setNodeRef, isOver } = useDroppable({
      id: `${CALENDAR_DAY_PREFIX}${dateStr}`,
      disabled: !isCurrentMonth,
    });

    return (
      <div ref={setNodeRef} className="relative">
        {children}
        {isOver && isCurrentMonth && (
          <div className="absolute inset-0 rounded-lg ring-2 ring-primary/40 bg-primary/5 pointer-events-none z-10" />
        )}
      </div>
    );
  }

  function DraggableTaskPill({ task }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: task.id,
    });

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`w-1.5 h-1.5 rounded-full bg-primary cursor-grab active:cursor-grabbing transition-opacity ${
          isDragging ? "opacity-40" : ""
        }`}
        title={task.title}
      />
    );
  }

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const dayTasks = getTasksForDate(currentDay);
        const isSelected = isSameDay(currentDay, selectedDate);
        const isCurrentMonth = isSameMonth(currentDay, monthStart);
        const isTodayDate = isToday(currentDay);
        const dateStr = format(currentDay, "yyyy-MM-dd");

        days.push(
          <DroppableDay key={currentDay.toString()} dateStr={dateStr} isCurrentMonth={isCurrentMonth}>
            <button
              onClick={() => setSelectedDate(currentDay)}
              className="relative p-2 h-12 w-full flex flex-col items-center justify-start rounded-lg transition-all"
              style={{
                backgroundColor: isSelected ? "var(--primary)" : isTodayDate ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
                color: isSelected ? "var(--text-inverted)" : isTodayDate ? "var(--primary)" : isCurrentMonth ? "var(--text-primary)" : "var(--text-muted)",
                opacity: isCurrentMonth ? 1 : 0.4,
              }}
              onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)")}
              onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = isTodayDate ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent")}
            >
              <span className="text-sm">{format(currentDay, "d")}</span>
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <DraggableTaskPill key={task.id} task={task} />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className={`text-[8px] font-medium ${isSelected ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          </DroppableDay>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1">
          {days}
        </div>
      );
      days = [];
    }
    return <div className="space-y-1">{rows}</div>;
  };

  if (status === "loading" || loading || !currentMonth || !selectedDate) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-20 space-y-6">
        <div>
          <div className="skeleton-line h-7 w-32 mb-2" />
          <div className="skeleton-line h-4 w-48" />
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex justify-between mb-4">
            <div className="skeleton-line h-6 w-32" />
            <div className="flex gap-2">
              <div className="skeleton-line w-8 h-8 rounded" />
              <div className="skeleton-line w-8 h-8 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="skeleton-line h-10 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <FaCalendarAlt className="text-primary" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("subtitle")}
          </p>
        </div>
        
        {/* View Toggle for Mobile */}
        <div className="flex bg-[var(--card-bg)] p-1 rounded-lg border border-[var(--card-border)] lg:hidden self-start">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'month'
                ? 'bg-primary text-text-inverted'
                : 'text-[var(--text-muted)] hover:bg-[var(--background)]'
            }`}
          >
            {t("month")}
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'timeline'
                ? 'bg-primary text-text-inverted'
                : 'text-[var(--text-muted)] hover:bg-[var(--background)]'
            }`}
          >
            {t("dayView")}
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleCalendarDragStart}
        onDragEnd={handleCalendarDragEnd}
        onDragCancel={handleCalendarDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)] min-h-[500px]">
          {/* Month Calendar - Hidden on mobile if in timeline mode */}
          <div
            className={`lg:col-span-4 flex flex-col ${viewMode === 'timeline' ? 'hidden lg:flex' : 'flex'}`}
          >
            <div
              className="rounded-xl p-4 shadow-sm border border-[var(--card-border)] bg-[var(--card-bg)] h-fit"
            >
              {renderHeader()}
              {renderDays()}
              {renderCells()}
            </div>

            {/* Legend / Quick Stats */}
            <div className="mt-4 p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{t("statsFor", { date: format(selectedDate, 'MMM d') })}</h3>
              <div className="flex gap-4 text-xs">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-primary"></div>
                   <span style={{ color: "var(--text-secondary)" }}>{selectedDateTasks.filter(t => !t.completed).length} {t("pending")}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-success"></div>
                   <span style={{ color: "var(--text-secondary)" }}>{selectedDateTasks.filter(t => t.completed).length} {t("done")}</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Timeline View - Hidden on mobile if in month mode */}
          <div
            className={`lg:col-span-8 flex flex-col h-full ${viewMode === 'month' ? 'hidden lg:flex' : 'flex'}`}
          >
            <div className="flex flex-col h-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm overflow-hidden">
              {/* Minimalist Header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--card-border)]">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    {isToday(selectedDate) ? t("today") : format(selectedDate, "EEE")}
                  </span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {format(selectedDate, "MMM d")}
                  </span>
                </div>
                {selectedDateTasks.length > 0 && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {selectedDateTasks.length}
                  </span>
                )}
              </div>

              <DayTimeline
                date={selectedDate}
                tasks={selectedDateTasks}
                onToggleComplete={toggleComplete}
                onDelete={deleteTask}
                onEdit={handleEditTask}
              />
            </div>
          </div>
        </div>

        {/* DragOverlay for month view */}
        <DragOverlay dropAnimation={DROP_ANIMATION_CONFIG}>
          {activeDragTask ? (
            <div className="px-2 py-1 text-xs font-medium bg-primary text-white rounded shadow-lg max-w-[120px] truncate">
              {activeDragTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDetailPanel
        taskId={selectedTaskId}
        tasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onSave={refetch}
      />
    </div>
  );
}
