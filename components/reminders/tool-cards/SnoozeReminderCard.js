"use client";

import { Card, ReminderRow, t } from "./shared";

export default function SnoozeReminderCard({ result, language }) {
  const r = result.reminder;
  const mins = result.snoozedMinutes;
  return (
    <Card accent="amber">
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ fontSize: "14px" }}>⏰</span>
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, `已延後 ${mins} 分鐘`, `Snoozed ${mins} minutes`)}
        </span>
      </div>
      {r && <ReminderRow reminder={r} language={language} />}
    </Card>
  );
}
