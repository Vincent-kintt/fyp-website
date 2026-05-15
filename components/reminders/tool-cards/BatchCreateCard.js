"use client";

import { FaCheck } from "react-icons/fa";
import { Card, t } from "./shared";

export default function BatchCreateCard({ result, language }) {
  return (
    <Card accent="green">
      <div className="flex items-center gap-2">
        <FaCheck style={{ color: "var(--success)", fontSize: "12px" }} />
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, `批量建立了 ${result.count} 個提醒`, `Created ${result.count} reminders`)}
        </span>
      </div>
      {result.pattern && (
        <div className="mt-1.5" style={{ color: "var(--modal-text-muted)" }}>
          {t(language, "模式: ", "Pattern: ")}{result.pattern}
        </div>
      )}
    </Card>
  );
}
