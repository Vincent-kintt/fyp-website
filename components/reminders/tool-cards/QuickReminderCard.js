"use client";

import { Card, ReminderRow, t } from "./shared";

export default function QuickReminderCard({ result, language }) {
  const r = result.reminder;
  if (!r) return null;
  return (
    <Card accent="green">
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ fontSize: "14px" }}>⚡</span>
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, "快速提醒已設定", "Quick reminder set")}
        </span>
      </div>
      <ReminderRow reminder={r} language={language} />
    </Card>
  );
}
