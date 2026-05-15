"use client";

import { Card, ReminderRow, t } from "./shared";

export default function TemplateCreateCard({ result, language }) {
  const r = result.reminder;
  if (!r) return null;
  return (
    <Card accent="green">
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ fontSize: "14px" }}>📋</span>
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, "從模板建立", "Created from template")}
        </span>
      </div>
      <ReminderRow reminder={r} language={language} />
    </Card>
  );
}
