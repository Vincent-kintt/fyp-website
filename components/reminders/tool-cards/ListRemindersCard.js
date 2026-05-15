"use client";

import { Card, ReminderRow, t } from "./shared";

export default function ListRemindersCard({ result, language }) {
  const reminders = result.reminders || [];
  const SHOW_MAX = 4;

  return (
    <Card accent="default">
      <div className="flex items-center justify-between mb-2 pb-2"
        style={{ borderBottom: reminders.length > 0 ? "1px solid var(--glass-border)" : "none" }}>
        <span className="font-semibold text-sm" style={{ color: "var(--modal-text)" }}>
          {t(language, "提醒列表", "Reminders")}
        </span>
        <span className="rounded-full px-2.5 py-0.5 font-medium"
          style={{ fontSize: "11px", color: "var(--modal-text-muted)", background: "var(--modal-accent-light)" }}>
          {result.count} {t(language, "個", "found")}
        </span>
      </div>
      {reminders.length === 0 ? (
        <div className="text-center py-4" style={{ color: "var(--modal-text-muted)" }}>
          {t(language, "沒有找到提醒", "No reminders found")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reminders.slice(0, SHOW_MAX).map((r, i) => <ReminderRow key={i} reminder={r} language={language} />)}
          {reminders.length > SHOW_MAX && (
            <div className="text-center py-1.5 rounded" style={{ color: "var(--modal-text-muted)", background: "var(--glass-bg)", border: "1px dashed var(--glass-border)" }}>
              +{reminders.length - SHOW_MAX} {t(language, "個更多提醒", "more reminders")}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
