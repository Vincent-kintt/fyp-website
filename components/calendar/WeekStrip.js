"use client";

import { addDays, format, isSameDay, isToday, startOfWeek } from "date-fns";

/**
 * WeekStrip — horizontal 7-day selector, like Fantastical's DayTicker.
 *
 * Props:
 *   date           — any Date in the week to display
 *   selectedDate   — the currently selected Date
 *   onDateSelect   — (date: Date) => void
 *   tasksByDate    — { [dateStr: string]: reminder[] } from buildTasksByDate
 */
export default function WeekStrip({
  date,
  selectedDate,
  onDateSelect,
  tasksByDate = {},
}) {
  const weekStart = startOfWeek(date);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div
      data-testid="week-strip"
      className="flex gap-1 px-4 py-2 overflow-x-auto"
    >
      {days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentDay = isToday(day);
        const hasTasks =
          tasksByDate[dateStr] && tasksByDate[dateStr].length > 0;

        const dayName = format(day, "EEE").toUpperCase();
        const dayNumber = format(day, "d");

        let textColor = "var(--text-secondary)";
        if (isSelected) {
          textColor = "white";
        } else if (isCurrentDay) {
          textColor = "var(--accent)";
        }

        let dotColor = "var(--accent)";
        if (isSelected) {
          dotColor = "white";
        }

        return (
          <button
            key={dateStr}
            onClick={() => onDateSelect(day)}
            className="flex flex-col items-center gap-0.5 flex-1 min-w-[44px] rounded-lg py-1.5 transition-colors"
            style={{
              backgroundColor: isSelected ? "var(--accent)" : "transparent",
            }}
            aria-label={format(day, "EEEE, MMMM d")}
            aria-pressed={isSelected}
          >
            {/* Day name */}
            <span
              className="text-[11px] uppercase tracking-wide font-medium"
              style={{ color: textColor }}
            >
              {dayName}
            </span>

            {/* Date number */}
            <span
              className="text-[18px] font-semibold leading-none"
              style={{ color: textColor }}
            >
              {dayNumber}
            </span>

            {/* Dot indicator */}
            <span
              className="block rounded-full"
              style={{
                width: "4px",
                height: "4px",
                backgroundColor: hasTasks ? dotColor : "transparent",
              }}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
