"use client";

import { Card, t } from "./shared";

export default function SuggestRemindersCard({ result, language }) {
  return (
    <Card accent="default">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: "14px" }}>💡</span>
        <span className="font-semibold text-sm" style={{ color: "var(--modal-text)" }}>
          {t(language, "建議", "Suggestions")}
        </span>
      </div>
      {result.suggestions?.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {result.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md py-1.5 px-2"
              style={{ background: "var(--glass-bg)", fontSize: "12px", color: "var(--modal-text-secondary)" }}>
              <span style={{ color: "var(--modal-text-muted)", flexShrink: 0 }}>→</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
