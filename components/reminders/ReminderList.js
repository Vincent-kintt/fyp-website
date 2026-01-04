"use client";

import ReminderCard from "./ReminderCard";

export default function ReminderList({ reminders, onDelete }) {
  if (!reminders || reminders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg" style={{ color: "var(--text-muted)" }}>No reminders found. Create your first reminder!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {reminders.map((reminder) => (
        <ReminderCard key={reminder.id} reminder={reminder} onDelete={onDelete} />
      ))}
    </div>
  );
}
