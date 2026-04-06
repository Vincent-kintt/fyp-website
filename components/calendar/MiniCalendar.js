"use client";

import { useTranslations } from "next-intl";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
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

/**
 * MiniCalendar — compact month grid with dot indicators for dates with tasks.
 *
 * @param {Object} props
 * @param {Date}   props.currentMonth   — which month to display
 * @param {Date}   props.selectedDate   — which date is highlighted
 * @param {(Date) => void} props.onMonthChange — called with new month when navigating
 * @param {(Date) => void} props.onDateSelect  — called when a day is clicked
 * @param {Object} props.tasksByDate    — map of "YYYY-MM-DD" → reminder[]
 */
export default function MiniCalendar({
  currentMonth,
  selectedDate,
  onMonthChange,
  onDateSelect,
  tasksByDate = {},
}) {
  const t = useTranslations("calendar");

  const dayKeys = ["days.sun", "days.mon", "days.tue", "days.wed", "days.thu", "days.fri", "days.sat"];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  // Build weeks array
  const weeks = [];
  let day = startDate;
  while (day <= endDate) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button
          aria-label="Previous month"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="p-2 hover:opacity-70 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>

        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>

        <button
          aria-label="Next month"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="p-2 hover:opacity-70 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <FaChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-2">
        {dayKeys.map((key) => (
          <div
            key={key}
            className="text-center text-xs font-medium py-1"
            style={{ color: "var(--text-muted)" }}
          >
            {t(key)}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="space-y-1">
        {weeks.map((week) => (
          <div key={week[0].toISOString()} className="grid grid-cols-7">
            {week.map((cellDay) => {
              const dateStr = format(cellDay, "yyyy-MM-dd");
              const isCurrentMonth = isSameMonth(cellDay, monthStart);
              const isTodayDate = isToday(cellDay);
              const isSelected = selectedDate ? isSameDay(cellDay, selectedDate) : false;
              const hasTasks = tasksByDate[dateStr] && tasksByDate[dateStr].length > 0;

              // Determine button style
              let bgColor = "transparent";
              let textColor = isCurrentMonth ? "var(--text-primary)" : "var(--text-muted)";

              if (isTodayDate && !isSelected) {
                bgColor = "var(--accent)";
                textColor = "#ffffff";
              } else if (isSelected) {
                bgColor = "color-mix(in srgb, var(--accent) 20%, transparent)";
                textColor = "var(--accent)";
              }

              const dotColor = isSelected ? "#ffffff" : "var(--accent)";

              return (
                <button
                  key={dateStr}
                  onClick={() => onDateSelect(cellDay)}
                  className="selected relative flex flex-col items-center justify-center rounded-lg h-8 w-full transition-all"
                  data-selected={isSelected}
                  data-today={isTodayDate}
                  style={{
                    backgroundColor: bgColor,
                    color: textColor,
                    opacity: isCurrentMonth ? 1 : 0.4,
                  }}
                >
                  <span className="text-xs leading-none">{format(cellDay, "d")}</span>
                  {hasTasks && (
                    <span
                      data-dot="true"
                      className="absolute bottom-0.5 w-1 h-1 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
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
