"use client";

import { FaCheck } from "react-icons/fa";
import { Card, ReminderRow, t } from "./shared";

export default function CreateReminderCard({ result, language }) {
  const r = result.reminder;
  if (!r) return null;
  return (
    <Card accent="green">
      <div className="flex items-center gap-2 mb-1.5">
        <FaCheck style={{ color: "var(--success)", fontSize: "12px" }} />
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, "已建立", "Created")}
        </span>
      </div>
      <ReminderRow reminder={r} language={language} />
      {r.tags && r.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.tags.map((tag, i) => (
            <span key={i} className="rounded-full px-2 py-0.5"
              style={{ fontSize: "10px", background: "var(--glass-bg)", color: "var(--modal-text-secondary)", border: "1px solid var(--glass-border)" }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
