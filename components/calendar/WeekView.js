"use client";
import { useMemo } from "react";
import { startOfWeek, addDays, format } from "date-fns";
import TimeGrid from "./TimeGrid";
import { getActiveRemindersForDate } from "@/lib/calendar";

export default function WeekView({
  date,
  reminders,
  onSlotClick,
  onReminderClick,
  onToggleComplete,
  locale,
}) {
  const dates = useMemo(() => {
    const weekStart = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [date]);

  const remindersByDate = useMemo(() => {
    const map = {};
    for (const d of dates) {
      const dateStr = format(d, "yyyy-MM-dd");
      map[dateStr] = getActiveRemindersForDate(reminders, d);
    }
    return map;
  }, [dates, reminders]);

  return (
    <TimeGrid
      dates={dates}
      remindersByDate={remindersByDate}
      onSlotClick={onSlotClick}
      onReminderClick={onReminderClick}
      onToggleComplete={onToggleComplete}
      locale={locale}
    />
  );
}
