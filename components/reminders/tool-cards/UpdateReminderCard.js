"use client";

import { FaCheck } from "react-icons/fa";
import { Card, ReminderRow, t } from "./shared";

export default function UpdateReminderCard({ result, language }) {
  const r = result.reminder;
  if (!r) return null;
  return (
    <Card accent="blue">
      <div className="flex items-center gap-2 mb-1.5">
        <FaCheck style={{ color: "var(--primary)", fontSize: "12px" }} />
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, "已更新", "Updated")}
        </span>
      </div>
      <ReminderRow reminder={r} language={language} />
    </Card>
  );
}
