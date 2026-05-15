"use client";

import { Card, t } from "./shared";

export default function AskClarificationCard({ result, language }) {
  return (
    <Card accent="amber">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: "14px" }}>❓</span>
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, "需要更多資訊", "Need more info")}
        </span>
      </div>
      <div style={{ color: "var(--modal-text-secondary)", fontSize: "12px" }}>
        {result.question}
      </div>
    </Card>
  );
}
