"use client";

import { FaCheck, FaTimes } from "react-icons/fa";
import { formatDateCompact } from "@/lib/format";

export const t = (lang, zh, en) => lang === "zh" ? zh : en;

export const STATUS_CONFIG = {
  pending:     { zh: "待辦",   en: "Pending",     color: "var(--text-muted)",  bg: "var(--glass-bg)" },
  in_progress: { zh: "進行中", en: "In Progress", color: "var(--primary)",     bg: "var(--modal-accent-light)" },
  completed:   { zh: "完成",   en: "Done",        color: "var(--success)",     bg: "var(--tool-success-bg)" },
  snoozed:     { zh: "已延後", en: "Snoozed",     color: "var(--warning)",     bg: "var(--warning-light)" },
};

export const PRIORITY_COLORS = { high: "var(--danger)", medium: "var(--warning)", low: "var(--success)" };

export function Card({ accent, children, className = "" }) {
  const borderColor = accent === "green" ? "var(--tool-success-border)"
    : accent === "red" ? "var(--tool-error-border)"
    : accent === "blue" ? "var(--modal-accent-border)"
    : accent === "amber" ? "rgba(245, 158, 11, 0.25)"
    : "var(--glass-border)";
  const bgColor = accent === "green" ? "var(--tool-success-bg)"
    : accent === "red" ? "var(--tool-error-bg)"
    : accent === "blue" ? "var(--modal-accent-light)"
    : accent === "amber" ? "rgba(245, 158, 11, 0.06)"
    : "var(--glass-bg)";

  return (
    <div className={`rounded-lg text-xs ${className}`}
      style={{ background: bgColor, border: `1px solid ${borderColor}`, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

export function ReminderRow({ reminder, language }) {
  const status = STATUS_CONFIG[reminder.status] || STATUS_CONFIG.pending;
  const priorityColor = PRIORITY_COLORS[reminder.priority] || "var(--text-muted)";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md"
      style={{ padding: "10px 12px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="shrink-0 w-2 h-2 rounded-full" style={{ background: priorityColor }} />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate" style={{ color: "var(--modal-text)", maxWidth: "200px" }}>
            {reminder.title || t(language, "未命名", "Untitled")}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5" style={{ color: "var(--modal-text-muted)", fontSize: "11px" }}>
            <span>{formatDateCompact(reminder.dateTime, language)}</span>
          </div>
        </div>
      </div>
      <span className="shrink-0 rounded-full px-2 py-0.5 font-medium"
        style={{ fontSize: "10px", color: status.color, background: status.bg }}>
        {language === "zh" ? status.zh : status.en}
      </span>
    </div>
  );
}

export function ErrorCard({ error, language }) {
  return (
    <Card accent="red">
      <div className="flex items-center gap-2">
        <FaTimes style={{ color: "var(--danger)", fontSize: "12px", flexShrink: 0 }} />
        <div>
          <span className="font-medium" style={{ color: "var(--modal-text)" }}>
            {t(language, "執行失敗", "Execution failed")}
          </span>
          {error && (
            <div className="mt-0.5" style={{ color: "var(--modal-text-muted)", fontSize: "11px" }}>
              {typeof error === "string" ? error : error.message || JSON.stringify(error)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function GenericSuccessCard({ tool, language }) {
  return (
    <Card accent="green">
      <div className="flex items-center gap-2">
        <FaCheck style={{ color: "var(--success)", fontSize: "12px" }} />
        <span style={{ color: "var(--modal-text)" }}>{tool}: {t(language, "已完成", "Completed")}</span>
      </div>
    </Card>
  );
}
