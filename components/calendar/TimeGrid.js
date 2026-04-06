"use client";

import { useEffect, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import {
  HOUR_HEIGHT,
  TIME_LABEL_WIDTH,
  getBlockTop,
  getBlockHeight,
  clipReminderToDay,
  groupOverlappingReminders,
  formatHourLabel,
} from "@/lib/calendar";
import EventBlock from "./EventBlock";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * TimeGrid — the shared scrollable time grid used by DayView and WeekView.
 *
 * @param {{ dates: Date[], remindersByDate: Object, onSlotClick: Function,
 *           onReminderClick: Function, onToggleComplete: Function, locale: string }} props
 */
export default function TimeGrid({
  dates = [],
  remindersByDate = {},
  onSlotClick,
  onReminderClick,
  onToggleComplete,
  locale = "zh-TW",
}) {
  // Current time — null on first render to avoid SSR/hydration mismatch
  const [currentTime, setCurrentTime] = useState(null);
  const scrollRef = useRef(null);

  // Hydrate current time after mount, then tick every 60s
  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to hour 7 on mount (shows 8 AM area)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  // Is today in this grid's date range?
  const todayIndex = dates.findIndex((d) => isToday(d));
  const hasToday = todayIndex !== -1;

  // Current time indicator position (px from top)
  const currentTimePx = currentTime
    ? (currentTime.getHours() + currentTime.getMinutes() / 60) * HOUR_HEIGHT
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Sticky day-header row                                               */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex flex-shrink-0 sticky top-0 z-20 border-b"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        {/* Spacer aligns headers with the time-label column */}
        <div style={{ width: TIME_LABEL_WIDTH, flexShrink: 0 }} />

        {dates.map((date) => {
          const isCurrentDay = isToday(date);
          const dayName = format(date, "EEE").toUpperCase();
          const dayNumber = format(date, "d");

          return (
            <div
              key={date.toISOString()}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
            >
              <span
                className="text-[11px] font-medium tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                {dayName}
              </span>
              <span
                className="text-[15px] font-semibold leading-none flex items-center justify-center w-7 h-7 rounded-full"
                style={{
                  backgroundColor: isCurrentDay
                    ? "var(--accent)"
                    : "transparent",
                  color: isCurrentDay ? "#ffffff" : "var(--text-primary)",
                }}
              >
                {dayNumber}
              </span>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Scrollable time-grid body                                           */}
      {/* ------------------------------------------------------------------ */}
      <div ref={scrollRef} className="flex flex-1 min-h-0 overflow-y-auto">
        {/* Time labels column */}
        <div
          className="flex-shrink-0 relative"
          style={{ width: TIME_LABEL_WIDTH }}
        >
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="relative"
              style={{ height: HOUR_HEIGHT }}
            >
              {/* Only show label for hours > 0 to avoid overlap with top edge */}
              {hour > 0 && (
                <span
                  className="absolute -top-2 right-2 text-[11px] select-none"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatHourLabel(hour, locale)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative min-w-0">
          {/* Current time indicator line (spans all columns) */}
          {hasToday && currentTimePx !== null && (
            <div
              className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
              style={{ top: currentTimePx }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 -ml-1.5"
                style={{ backgroundColor: "var(--time-indicator, #ef4444)" }}
              />
              <div
                className="flex-1 h-[2px]"
                style={{ backgroundColor: "var(--time-indicator, #ef4444)" }}
              />
            </div>
          )}

          {dates.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const reminders = remindersByDate[dateStr] ?? [];

            // Compute overlap layout for this day's reminders
            const overlapMap = groupOverlappingReminders(reminders);

            return (
              <div
                key={dateStr}
                className="flex-1 relative border-l min-w-0"
                style={{
                  borderColor: "var(--card-border)",
                  background: isToday(date) ? "rgba(66,133,244,0.04)" : "transparent",
                }}
              >
                {/* Hour rows */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="relative border-b"
                    style={{
                      height: HOUR_HEIGHT,
                      borderColor: "var(--card-border)",
                    }}
                  >
                    {/* Half-hour dashed line */}
                    <div
                      className="absolute left-0 right-0 border-b border-dashed"
                      style={{
                        top: "50%",
                        borderColor: "var(--card-border)",
                        opacity: 0.5,
                      }}
                    />

                    {/* Top half clickable slot */}
                    <div
                      className="absolute left-0 right-0 top-0 cursor-pointer hover:bg-[var(--accent)]/5 transition-colors"
                      style={{ height: "50%" }}
                      onClick={() => onSlotClick?.(dateStr, hour, 0)}
                    />

                    {/* Bottom half clickable slot */}
                    <div
                      className="absolute left-0 right-0 bottom-0 cursor-pointer hover:bg-[var(--accent)]/5 transition-colors"
                      style={{ height: "50%" }}
                      onClick={() => onSlotClick?.(dateStr, hour, 30)}
                    />
                  </div>
                ))}

                {/* Event blocks — rendered above the hour grid */}
                {reminders.map((reminder) => {
                  const clipped = clipReminderToDay(reminder, dateStr);
                  if (!clipped) return null;

                  const top = (clipped.startMinute / 30) * (HOUR_HEIGHT / 2);
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
        </div>
      </div>
    </div>
  );
}
