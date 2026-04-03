"use client";

import { useTranslations } from "next-intl";
import ReminderCard from "./ReminderCard";

export default function ReminderList({ reminders, onDelete, onUpdate }) {
  const t = useTranslations("reminders");

  if (!reminders || reminders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg" style={{ color: "var(--text-muted)" }}>{t("noReminders")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {reminders.map((reminder) => (
        <ReminderCard key={reminder.id} reminder={reminder} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
