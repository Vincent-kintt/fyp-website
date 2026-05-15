"use client";

import { useState } from "react";
import { Card, t } from "./shared";

export default function ExportRemindersCard({ result, language }) {
  const [copied, setCopied] = useState(false);
  const fmt = result.format || "json";
  const data = typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2);
  const itemCount = Array.isArray(result.data) ? result.data.length : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(data).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card accent="default">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "14px" }}>📤</span>
          <span className="font-medium" style={{ color: "var(--modal-text)" }}>
            {t(language, "已匯出", "Exported")}
          </span>
          <span className="rounded-full px-2 py-0.5 uppercase font-bold"
            style={{ fontSize: "9px", color: "var(--modal-accent)", background: "var(--modal-accent-light)", letterSpacing: "0.5px" }}>
            {fmt}
          </span>
        </div>
        <button onClick={handleCopy} className="rounded px-2 py-1 text-xs transition-colors"
          style={{ background: "var(--glass-bg)", color: copied ? "var(--success)" : "var(--modal-text-muted)", border: "1px solid var(--glass-border)" }}>
          {copied ? t(language, "已複製", "Copied") : t(language, "複製", "Copy")}
        </button>
      </div>
      {itemCount !== null && (
        <div style={{ fontSize: "11px", color: "var(--modal-text-muted)" }}>
          {itemCount} {t(language, "個項目", "items")}
        </div>
      )}
    </Card>
  );
}
