"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { format, isToday } from "date-fns";
import {
  HOUR_HEIGHT,
  SLOT_HEIGHT,
  TIME_LABEL_WIDTH,
  clipReminderToDay,
  getBlockHeight,
  groupOverlappingReminders,
  formatHourLabel,
} from "@/lib/calendar";
import EventBlock from "./EventBlock";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GRID_TOTAL_HEIGHT = 24 * HOUR_HEIGHT; // 2304px

export default function TimeGrid({
  dates = [],
  remindersByDate = {},
  onSlotClick,
  onReminderClick,
  onToggleComplete,
  locale = "zh-TW",
}) {
  const [currentTime, setCurrentTime] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  const todayIndex = dates.findIndex((d) => isToday(d));
  const hasToday = todayIndex !== -1;

  const currentTimePx = currentTime
    ? (currentTime.getHours() + currentTime.getMinutes() / 60) * HOUR_HEIGHT
    : null;

  // Click handler: determine which half-hour slot was clicked
  const handleColumnClick = useCallback(
    (dateStr, e) => {
      // getBoundingClientRect already accounts for ancestor scroll,
      // so e.clientY - rect.top gives the correct Y within the full column height
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = (y / HOUR_HEIGHT) * 60;
      const hour = Math.max(0, Math.min(23, Math.floor(totalMinutes / 60)));
      const minute = totalMinutes % 60 >= 30 ? 30 : 0;
      onSlotClick?.(dateStr, hour, minute);
    },
    [onSlotClick],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Day headers */}
      <div
        className="flex flex-shrink-0 border-b"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <div style={{ width: TIME_LABEL_WIDTH, flexShrink: 0 }} />
        {dates.map((date) => {
          const isCurrentDay = isToday(date);
          return (
            <div
              key={date.toISOString()}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 border-l"
              style={{ borderColor: "var(--card-border)" }}
            >
              <span
                className="text-[11px] font-medium tracking-wide uppercase"
                style={{ color: isCurrentDay ? "var(--accent)" : "var(--text-muted)" }}
              >
                {format(date, "EEE")}
              </span>
              <span
                className="text-[15px] font-semibold leading-none flex items-center justify-center w-7 h-7 rounded-full"
                style={{
                  backgroundColor: isCurrentDay ? "var(--accent)" : "transparent",
                  color: isCurrentDay ? "#fff" : "var(--text-primary)",
                }}
              >
                {format(date, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: GRID_TOTAL_HEIGHT, position: "relative" }}>
          {/* Time labels */}
          <div className="flex-shrink-0" style={{ width: TIME_LABEL_WIDTH }}>
            {HOURS.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                {hour > 0 && (
                  <span
                    className="absolute -top-[7px] right-2 text-[11px] select-none tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatHourLabel(hour, locale)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns — grid lines via CSS background */}
          {dates.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const reminders = remindersByDate[dateStr] ?? [];
            const overlapMap = groupOverlappingReminders(reminders);
            const isCurrentDay = isToday(date);

            return (
              <div
                key={dateStr}
                className="flex-1 relative min-w-0 cursor-pointer"
                style={{
                  borderLeft: "1px solid color-mix(in srgb, var(--card-border) 60%, transparent)",
                  height: GRID_TOTAL_HEIGHT,
                  // Grid lines via CSS background — Google Calendar pattern
                  backgroundImage: [
                    // Hour lines (solid, 1px)
                    `linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)`,
                    // Half-hour lines (dotted appearance via thinner + lower opacity)
                    `linear-gradient(to bottom, var(--grid-line-minor) 1px, transparent 1px)`,
                    // Today column tint
                    isCurrentDay
                      ? `linear-gradient(rgba(66,133,244,0.05), rgba(66,133,244,0.05))`
                      : "none",
                  ].join(", "),
                  backgroundSize: `100% ${HOUR_HEIGHT}px, 100% ${SLOT_HEIGHT}px, 100% 100%`,
                  backgroundPosition: `0 ${HOUR_HEIGHT}px, 0 ${SLOT_HEIGHT}px, 0 0`,
                  // Grid line CSS vars — matches Material Design 3 dark/light divider spec
                  "--grid-line": "var(--card-border)",
                  "--grid-line-minor": "color-mix(in srgb, var(--card-border) 35%, transparent)",
                }}
                onClick={(e) => handleColumnClick(dateStr, e)}
              >
                {/* Event blocks */}
                {reminders.map((reminder) => {
                  const clipped = clipReminderToDay(reminder, dateStr);
                  if (!clipped) return null;

                  const top = (clipped.startMinute / 30) * SLOT_HEIGHT;
                  const height = getBlockHeight(clipped.durationMinutes);
                  const overlap = overlapMap.get(reminder.id) ?? {
                    column: 0,
                    totalColumns: 1,
                  };

                  return (
                    <EventBlock
                      key={reminder.id}
                      reminder={reminder}
                      top={top}
                      height={height}
                      column={overlap.column}
                      totalColumns={overlap.totalColumns}
                      onClick={onReminderClick}
                      onToggleComplete={onToggleComplete}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Current time indicator */}
          {hasToday && currentTimePx !== null && (
            <div
              className="absolute z-10 flex items-center pointer-events-none"
              style={{
                top: currentTimePx,
                left: TIME_LABEL_WIDTH,
                right: 0,
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 -ml-[5px]"
                style={{ backgroundColor: "var(--time-indicator)" }}
              />
              <div
                className="flex-1 h-[2px]"
                style={{ backgroundColor: "var(--time-indicator)" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
