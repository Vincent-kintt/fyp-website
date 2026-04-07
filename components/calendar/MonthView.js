"use client";

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { useTranslations } from "next-intl";

const DAY_KEYS = [
  "days.sun",
  "days.mon",
  "days.tue",
  "days.wed",
  "days.thu",
  "days.fri",
  "days.sat",
];

const MAX_VISIBLE_BARS = 2;

/**
 * MonthView — full month grid showing event bars in each day cell.
 *
 * @param {Object} props
 * @param {Date}   props.currentMonth   — which month to display
 * @param {Date}   props.selectedDate   — highlighted date
 * @param {(Date) => void} props.onDateSelect  — called when a day cell is clicked
 * @param {Object} props.tasksByDate    — map of "YYYY-MM-DD" → reminder[]
 * @param {(Date) => void} props.onViewDay     — switches to day view
 */
export default function MonthView({
  currentMonth,
  selectedDate,
  onDateSelect,
  tasksByDate = {},
  onViewDay,
}) {
  const t = useTranslations("calendar");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  // Build weeks array
  const weeks = [];
  let day = gridStart;
  while (day <= gridEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  function handleDayClick(cellDay) {
    onDateSelect?.(cellDay);
    onViewDay?.(cellDay);
  }

  return (
    <div
      data-testid="month-view"
      className="flex flex-col h-full select-none"
    >
      {/* Day-of-week header */}
      <div
        className="grid grid-cols-7 border-b"
        style={{ borderColor: "var(--card-border)" }}
      >
        {DAY_KEYS.map((key) => (
          <div
            key={key}
            className="text-center text-xs font-medium py-2"
            style={{ color: "var(--text-muted)" }}
          >
            {t(key)}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div
        className="flex-1 grid"
        style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}
      >
        {weeks.map((week) => (
          <div
            key={week[0].toISOString()}
            className="grid grid-cols-7"
            style={{ borderBottom: "1px solid var(--card-border)" }}
          >
            {week.map((cellDay) => {
              const dateStr = format(cellDay, "yyyy-MM-dd");
              const inMonth = isSameMonth(cellDay, monthStart);
              const todayDate = isToday(cellDay);
              const tasks = tasksByDate[dateStr] ?? [];
              const visible = tasks.slice(0, MAX_VISIBLE_BARS);
              const overflow = tasks.length - MAX_VISIBLE_BARS;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(cellDay)}
                  className="flex flex-col items-start p-1 gap-0.5 min-h-[80px] w-full text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]"
                  style={{
                    borderRight: "1px solid var(--card-border)",
                    opacity: inMonth ? 1 : 0.38,
                  }}
                >
                  {/* Date number */}
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium leading-none shrink-0"
                    style={{
                      backgroundColor: todayDate
                        ? "var(--accent)"
                        : "transparent",
                      color: todayDate ? "#ffffff" : "var(--text-primary)",
                    }}
                  >
                    {format(cellDay, "d")}
                  </span>

                  {/* Task bars */}
                  {visible.map((task) => (
                    <span
                      key={task.id ?? task._id}
                      className="w-full truncate rounded px-1 leading-[18px]"
                      style={{
                        fontSize: "10px",
                        backgroundColor: "var(--event-bg)",
                        color: "var(--event-text)",
                      }}
                    >
                      {task.title}
                    </span>
                  ))}

                  {/* Overflow indicator */}
                  {overflow > 0 && (
                    <span
                      className="text-[10px] px-1 leading-[18px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t("nMore", { count: overflow })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
