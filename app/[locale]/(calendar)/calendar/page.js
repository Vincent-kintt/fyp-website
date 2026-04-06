"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useTasks } from "@/hooks/useTasks";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import {
  useDndSensors,
  DROP_ANIMATION_CONFIG,
  patchReminderStatus,
  parseDayDropId,
  parseSlotDropId,
  computeNewDateTime,
  computeSlotDateTime,
} from "@/lib/dnd";
import { buildTasksByDate } from "@/lib/calendar";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import ViewTabs from "@/components/calendar/ViewTabs";
import DayView from "@/components/calendar/DayView";
import WeekView from "@/components/calendar/WeekView";
import MonthView from "@/components/calendar/MonthView";
import AgendaView from "@/components/calendar/AgendaView";
import WeekStrip from "@/components/calendar/WeekStrip";
import QuickAddPopover from "@/components/calendar/QuickAddPopover";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

function useBreakpoint() {
  const [bp, setBp] = useState("desktop");
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setBp(w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return bp;
}


export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("calendar");
  const { tasks, loading, toggleComplete, deleteTask, quickAdd, refetch } =
    useTasks();

  const [currentMonth, setCurrentMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [quickAddSlot, setQuickAddSlot] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);

  const bp = useBreakpoint();
  const sensors = useDndSensors();
  const queryClient = useQueryClient();

  // Hydration init
  useEffect(() => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
    const w = window.innerWidth;
    setViewMode(w < 768 ? "agenda" : w < 1024 ? "day" : "week");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Navigation
  const navigateForward = useCallback(() => {
    if (viewMode === "week") {
      setSelectedDate((d) => addWeeks(d, 1));
    } else if (viewMode === "monthView") {
      setCurrentMonth((m) => addMonths(m, 1));
    } else {
      setSelectedDate((d) => addDays(d, 1));
    }
  }, [viewMode]);

  const navigateBack = useCallback(() => {
    if (viewMode === "week") {
      setSelectedDate((d) => subWeeks(d, 1));
    } else if (viewMode === "monthView") {
      setCurrentMonth((m) => subMonths(m, 1));
    } else {
      setSelectedDate((d) => subDays(d, 1));
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setSelectedDate(now);
    setCurrentMonth(now);
  }, []);

  // Quick add
  const handleSlotClick = useCallback((dateStr, hour, minute) => {
    setQuickAddSlot({ dateStr, hour, minute });
  }, []);

  const handleQuickAddSubmit = useCallback(
    ({ title, dateTime }) => {
      quickAdd({ title, dateTime, status: "pending" });
    },
    [quickAdd]
  );

  // DnD handlers
  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveDragId(null);
      if (!over) return;

      const draggedTask = tasks.find((task) => task.id === active.id);
      if (!draggedTask) return;

      // Try slot drop first (updates both date + time)
      const slotData = parseSlotDropId(over.id);
      if (slotData) {
        const newDateTime = computeSlotDateTime(slotData);
        const originalTasks = queryClient.getQueryData(reminderKeys.list({}));
        queryClient.setQueryData(
          reminderKeys.list({}),
          tasks.map((task) =>
            task.id === active.id ? { ...task, dateTime: newDateTime } : task
          )
        );
        try {
          await patchReminderStatus(active.id, { dateTime: newDateTime });
          toast.success(
            t("movedTo", {
              date: format(slotData.date, "M/d"),
            })
          );
        } catch {
          queryClient.setQueryData(reminderKeys.list({}), originalTasks);
          toast.error(t("moveFailed"));
        }
        return;
      }

      // Fall back to day drop (preserves time)
      const targetDate = parseDayDropId(over.id);
      if (!targetDate) return;

      if (!draggedTask.dateTime) return;

      const newDateTime = computeNewDateTime(draggedTask.dateTime, targetDate);
      const originalTasks = queryClient.getQueryData(reminderKeys.list({}));
      queryClient.setQueryData(
        reminderKeys.list({}),
        tasks.map((task) =>
          task.id === active.id ? { ...task, dateTime: newDateTime } : task
        )
      );
      try {
        await patchReminderStatus(active.id, { dateTime: newDateTime });
        toast.success(t("movedTo", { date: format(targetDate, "M/d") }));
      } catch {
        queryClient.setQueryData(reminderKeys.list({}), originalTasks);
        toast.error(t("moveFailed"));
      }
    },
    [tasks, queryClient, t]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const activeDragTask = activeDragId
    ? tasks.find((task) => task.id === activeDragId)
    : null;

  const tasksByDate = useMemo(() => buildTasksByDate(tasks), [tasks]);

  // Top bar title
  const topBarTitle = useMemo(() => {
    if (!selectedDate || !currentMonth || !viewMode) return "";
    if (viewMode === "week") {
      const ws = startOfWeek(selectedDate);
      const we = endOfWeek(selectedDate);
      return t("weekOf", {
        start: format(ws, "MMM d"),
        end: format(we, "MMM d"),
      });
    }
    if (viewMode === "monthView") {
      return format(currentMonth, "MMMM yyyy");
    }
    if (isToday(selectedDate)) return t("today");
    return format(selectedDate, "EEEE, MMM d");
  }, [viewMode, selectedDate, currentMonth, t]);

  if (
    status === "loading" ||
    loading ||
    !currentMonth ||
    !selectedDate ||
    !viewMode
  ) {
    return (
      <div className="flex h-full overflow-hidden items-center justify-center">
        <div className="skeleton-line h-8 w-48 rounded-lg" />
      </div>
    );
  }

  const isMobile = bp === "mobile";
  const isDesktop = bp === "desktop";

  return (
    <>
      <div className="flex h-full overflow-hidden">
        {/* Sidebar — desktop only */}
        {isDesktop && (
          <div
            className="w-[272px] shrink-0 flex flex-col border-r"
            style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <CalendarSidebar
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              reminders={tasks}
              tasksByDate={tasksByDate}
              onMonthChange={setCurrentMonth}
              onDateSelect={setSelectedDate}
              onReminderClick={setSelectedTaskId}
              onToggleComplete={toggleComplete}
              onQuickAdd={() =>
                handleSlotClick(
                  format(selectedDate, "yyyy-MM-dd"),
                  new Date().getHours(),
                  0
                )
              }
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar — desktop + tablet */}
          {!isMobile && (
            <div
              className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b"
              style={{ borderColor: "var(--card-border)" }}
            >
              <h2
                className="text-base font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {topBarTitle}
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t("today")}
                </button>
                <button
                  onClick={navigateBack}
                  className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <FaChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={navigateForward}
                  className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <FaChevronRight className="w-3.5 h-3.5" />
                </button>
                <ViewTabs
                  activeView={viewMode}
                  onViewChange={setViewMode}
                  availableViews={["day", "week", "monthView", "agenda"]}
                />
              </div>
            </div>
          )}

          {/* Mobile header */}
          {isMobile && (
            <div
              className="shrink-0 border-b"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center justify-between px-4 pt-2 pb-1">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isToday(selectedDate) ? t("today") : format(selectedDate, "EEEE, MMM d")}
                </span>
                <ViewTabs
                  activeView={viewMode}
                  onViewChange={setViewMode}
                  availableViews={["day", "agenda"]}
                />
              </div>
              <WeekStrip
                date={selectedDate}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                tasksByDate={tasksByDate}
              />
            </div>
          )}

          {/* Active view — wrapped in DndContext */}
          <div className="flex-1 min-h-0 relative">
            <DndContext
              sensors={isMobile ? [] : sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="h-full flex flex-col overflow-hidden">
                {viewMode === "day" && (
                  <DayView
                    date={selectedDate}
                    reminders={tasks}
                    onSlotClick={handleSlotClick}
                    onReminderClick={setSelectedTaskId}
                    onToggleComplete={toggleComplete}
                  />
                )}
                {viewMode === "week" && (
                  <WeekView
                    date={selectedDate}
                    reminders={tasks}
                    onSlotClick={handleSlotClick}
                    onReminderClick={setSelectedTaskId}
                    onToggleComplete={toggleComplete}
                  />
                )}
                {viewMode === "monthView" && (
                  <MonthView
                    currentMonth={currentMonth}
                    selectedDate={selectedDate}
                    onDateSelect={(date) => {
                      setSelectedDate(date);
                      setCurrentMonth(date);
                    }}
                    tasksByDate={tasksByDate}
                    onViewDay={(date) => {
                      setSelectedDate(date);
                      setViewMode("day");
                    }}
                  />
                )}
                {viewMode === "agenda" && (
                  <AgendaView
                    date={selectedDate}
                    reminders={tasks}
                    onReminderClick={setSelectedTaskId}
                    onToggleComplete={toggleComplete}
                  />
                )}
              </div>

              <DragOverlay dropAnimation={DROP_ANIMATION_CONFIG}>
                {activeDragTask ? (
                  <div className="px-2 py-1 text-xs font-medium bg-[var(--accent)] text-white rounded shadow-lg max-w-[120px] truncate">
                    {activeDragTask.title}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* QuickAddPopover backdrop + popover */}
            {quickAddSlot && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setQuickAddSlot(null)}
                />
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30">
                  <QuickAddPopover
                    dateStr={quickAddSlot.dateStr}
                    hour={quickAddSlot.hour}
                    minute={quickAddSlot.minute}
                    onSubmit={handleQuickAddSubmit}
                    onClose={() => setQuickAddSlot(null)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <TaskDetailPanel
        taskId={selectedTaskId}
        tasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onSave={refetch}
      />
    </>
  );
}
