"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { getRemindersForDate } from "@/lib/calendar";
import AgendaCard from "./AgendaCard";

/**
 * AgendaView — chronological scrolling list of reminders for a given date,
 * grouped by hour with a time label header.
 *
 * Props:
 *   date              — the Date to show
 *   reminders         — all reminders array
 *   onReminderClick   — (id) => void
 *   onToggleComplete  — (id, completed) => void
 */
export default function AgendaView({
  date,
  reminders,
  onReminderClick,
  onToggleComplete,
}) {
  const t = useTranslations("calendar");

  // Hydration-safe current time: null on first render, set in useEffect
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const sortedReminders = useMemo(() => {
    const filtered = getRemindersForDate(reminders, date);
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.dateTime).getTime();
      const tb = new Date(b.dateTime).getTime();
      return ta - tb;
    });
  }, [reminders, date]);

  // Group by hour
  const groups = useMemo(() => {
    const map = new Map(); // hour (number) → reminder[]
    for (const reminder of sortedReminders) {
      const hour = new Date(reminder.dateTime).getHours();
      if (!map.has(hour)) map.set(hour, []);
      map.get(hour).push(reminder);
    }
    return map;
  }, [sortedReminders]);

  if (sortedReminders.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center pb-24">
        <span
          className="text-[14px]"
          style={{ color: "var(--text-muted)" }}
        >
          {t("noTasks")}
        </span>
      </div>
    );
  }

  const currentHour = now ? now.getHours() : -1;

  return (
    <div className="flex flex-col gap-2 px-4 pt-2 pb-24 overflow-y-auto">
      {Array.from(groups.entries()).map(([hour, items]) => {
        const isNowHour = now !== null && hour === currentHour;

        return (
          <div key={hour} className="flex flex-col gap-1">
            {/* Hour label */}
            <div className="flex items-baseline gap-1">
              <span
                className="text-[11px] uppercase tracking-wider font-medium"
                style={{
                  color: isNowHour
                    ? "var(--time-indicator)"
                    : "var(--text-muted)",
                }}
              >
                {format(new Date(items[0].dateTime), "h a")}
              </span>
              {isNowHour && (
                <span
                  className="text-[9px] uppercase tracking-wider font-medium"
                  style={{ color: "var(--time-indicator)" }}
                >
                  — {t("now")}
                </span>
              )}
            </div>

            {/* Cards in this hour */}
            <div className="flex flex-col gap-1 pl-2">
              {items.map((reminder) => (
                <AgendaCard
                  key={reminder.id}
                  reminder={reminder}
                  onClick={onReminderClick}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
