"use client";

import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { useTranslations } from "next-intl";
import { getRemindersForDate } from "@/lib/calendar";
import MiniCalendar from "./MiniCalendar";

/**
 * CalendarSidebar — left sidebar with mini calendar, today's task list,
 * and a quick-add button.
 *
 * @param {Object} props
 * @param {Date}   props.currentMonth
 * @param {Date}   props.selectedDate
 * @param {Array}  props.reminders         — all reminders
 * @param {Object} props.tasksByDate        — map of "YYYY-MM-DD" → reminder[]
 * @param {(Date) => void} props.onMonthChange
 * @param {(Date) => void} props.onDateSelect
 * @param {(id: string) => void} props.onReminderClick
 * @param {(id: string, completed: boolean) => void} props.onToggleComplete
 * @param {() => void} props.onQuickAdd
 */
export default function CalendarSidebar({
  currentMonth,
  selectedDate,
  reminders = [],
  tasksByDate = {},
  onMonthChange,
  onDateSelect,
  onReminderClick,
  onToggleComplete,
  onQuickAdd,
}) {
  const t = useTranslations("calendar");

  const dateReminders = useMemo(() => {
    const list = getRemindersForDate(reminders, selectedDate);
    return [...list].sort((a, b) => {
      if (!a.dateTime) return 1;
      if (!b.dateTime) return -1;
      return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    });
  }, [reminders, selectedDate]);

  const headerLabel = selectedDate && isToday(selectedDate)
    ? t("today")
    : selectedDate
      ? format(selectedDate, "MMM d")
      : t("today");

  return (
    <aside
      className="flex flex-col h-full"
    >
      {/* Mini calendar */}
      <div className="p-4 shrink-0">
        <MiniCalendar
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onMonthChange={onMonthChange}
          onDateSelect={onDateSelect}
          tasksByDate={tasksByDate}
        />
      </div>

      {/* Divider */}
      <div
        className="shrink-0 mx-4"
        style={{ height: "1px", backgroundColor: "var(--card-border)" }}
      />

      {/* Task list for selected date */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1 min-h-0">
        {/* Section header */}
        <span
          className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          {headerLabel}
        </span>

        {dateReminders.length === 0 ? (
          <div
            className="flex items-center justify-center py-6 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {t("noTasks")}
          </div>
        ) : (
          dateReminders.map((reminder) => {
            const isCompleted =
              reminder.status === "completed" || reminder.completed;

            let timeLabel = "";
            try {
              timeLabel = format(new Date(reminder.dateTime), "h:mm a");
            } catch {
              timeLabel = "";
            }

            return (
              <button
                key={reminder.id ?? reminder._id}
                onClick={() => onReminderClick?.(reminder.id ?? reminder._id)}
                className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
              >
                {/* Status dot */}
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isCompleted
                      ? "var(--text-muted)"
                      : "var(--accent)",
                  }}
                />

                {/* Title + time */}
                <span className="flex-1 flex flex-col min-w-0">
                  <span
                    className="text-sm truncate leading-snug"
                    style={{
                      color: "var(--text-primary)",
                      textDecoration: isCompleted ? "line-through" : "none",
                      opacity: isCompleted ? 0.5 : 1,
                    }}
                  >
                    {reminder.title}
                  </span>
                  {timeLabel && (
                    <span
                      className="text-[11px] leading-none mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {timeLabel}
                    </span>
                  )}
                </span>

                {/* Checkbox */}
                <span
                  role="checkbox"
                  aria-checked={isCompleted}
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete?.(
                      reminder.id ?? reminder._id,
                      !isCompleted
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " ") {
                      e.stopPropagation();
                      onToggleComplete?.(
                        reminder.id ?? reminder._id,
                        !isCompleted
                      );
                    }
                  }}
                  className="shrink-0 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="1.5" y="1.5" width="13" height="13" rx="3.5"
                      stroke="var(--card-border)" strokeWidth="1.5"
                      fill={isCompleted ? "var(--accent)" : "none"}
                    />
                    {isCompleted && (
                      <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Quick add button */}
      <div className="shrink-0 p-4">
        <button
          onClick={onQuickAdd}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors border border-dashed"
          style={{
            borderColor: "var(--card-border)",
            color: "var(--text-secondary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--accent) 5%, transparent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--card-border)";
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <span className="text-base leading-none">+</span>
          {t("addTask")}
        </button>
      </div>
    </aside>
  );
}
