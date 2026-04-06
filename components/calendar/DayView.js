"use client";
import { useMemo } from "react";
import { format } from "date-fns";
import TimeGrid from "./TimeGrid";
import { getRemindersForDate } from "@/lib/calendar";

export default function DayView({
  date,
  reminders,
  onSlotClick,
  onReminderClick,
  onToggleComplete,
  locale,
}) {
  const dates = useMemo(() => [date], [date]);

  const remindersByDate = useMemo(() => {
    const dateStr = format(date, "yyyy-MM-dd");
    return { [dateStr]: getRemindersForDate(reminders, date) };
  }, [date, reminders]);

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
