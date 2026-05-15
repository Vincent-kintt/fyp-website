"use client";

import { FaCheck } from "react-icons/fa";
import { formatDateCompact } from "@/lib/format";
import { Card, ReminderRow, t } from "./shared";

export default function FindConflictsCard({ result, language }) {
  if (!result.hasConflicts) {
    return (
      <Card accent="green">
        <div className="flex items-center gap-2">
          <FaCheck style={{ color: "var(--success)", fontSize: "12px" }} />
          <span style={{ color: "var(--modal-text)" }}>
            {t(language, "沒有時間衝突", "No time conflicts")}
          </span>
        </div>
      </Card>
    );
  }
  return (
    <Card accent="red">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: "14px" }}>⚠️</span>
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, `發現 ${result.conflicts.length} 個衝突`, `${result.conflicts.length} conflict(s) found`)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {result.conflicts.slice(0, 3).map((c, i) => <ReminderRow key={i} reminder={c} language={language} />)}
      </div>
      {result.suggestedTimes?.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <div className="mb-1" style={{ color: "var(--modal-text-muted)", fontSize: "11px" }}>
            {t(language, "建議時段:", "Suggested times:")}
          </div>
          <div className="flex flex-wrap gap-1">
            {result.suggestedTimes.map((time, i) => (
              <span key={i} className="rounded-full px-2 py-0.5"
                style={{ fontSize: "10px", background: "var(--tool-success-bg)", border: "1px solid var(--tool-success-border)", color: "var(--success)" }}>
                {formatDateCompact(time, language)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
