"use client";

import { useState } from "react";
import { FaCheck, FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";

const t = (lang, zh, en) => lang === "zh" ? zh : en;

function formatDate(dateTime, language) {
  if (!dateTime) return language === "zh" ? "未設定" : "No date";
  const d = new Date(dateTime);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return language === "zh" ? "未設定" : "No date";
  return d.toLocaleDateString(language === "zh" ? "zh-TW" : "en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

const STATUS_CONFIG = {
  pending:     { zh: "待辦",   en: "Pending",     color: "var(--text-muted)",  bg: "var(--glass-bg)" },
  in_progress: { zh: "進行中", en: "In Progress", color: "var(--primary)",     bg: "var(--modal-accent-light)" },
  completed:   { zh: "完成",   en: "Done",        color: "var(--success)",     bg: "var(--tool-success-bg)" },
  snoozed:     { zh: "已延後", en: "Snoozed",     color: "var(--warning)",     bg: "var(--warning-light)" },
};

const PRIORITY_COLORS = { high: "var(--danger)", medium: "var(--warning)", low: "var(--success)" };

// Shared card wrapper
function Card({ accent, children, className = "" }) {
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

// Shared reminder mini-card (reused by list, create, update, etc.)
function ReminderRow({ reminder, language }) {
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
            <span>{formatDate(reminder.dateTime, language)}</span>
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

// ---- Tool-specific renderers ----

function ListRemindersCard({ result, language }) {
  const reminders = result.reminders || [];
  const SHOW_MAX = 4;

  return (
    <Card accent="default">
      <div className="flex items-center justify-between mb-2 pb-2"
        style={{ borderBottom: reminders.length > 0 ? "1px solid var(--glass-border)" : "none" }}>
        <span className="font-semibold text-sm" style={{ color: "var(--modal-text)" }}>
          {t(language, "提醒列表", "Reminders")}
        </span>
        <span className="rounded-full px-2.5 py-0.5 font-medium"
          style={{ fontSize: "11px", color: "var(--modal-text-muted)", background: "var(--modal-accent-light)" }}>
          {result.count} {t(language, "個", "found")}
        </span>
      </div>
      {reminders.length === 0 ? (
        <div className="text-center py-4" style={{ color: "var(--modal-text-muted)" }}>
          {t(language, "沒有找到提醒", "No reminders found")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reminders.slice(0, SHOW_MAX).map((r, i) => <ReminderRow key={i} reminder={r} language={language} />)}
          {reminders.length > SHOW_MAX && (
            <div className="text-center py-1.5 rounded" style={{ color: "var(--modal-text-muted)", background: "var(--glass-bg)", border: "1px dashed var(--glass-border)" }}>
              +{reminders.length - SHOW_MAX} {t(language, "個更多提醒", "more reminders")}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function CreateReminderCard({ result, language }) {
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

function UpdateReminderCard({ result, language }) {
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

function DeleteReminderCard({ input, language }) {
  return (
    <Card accent="red">
      <div className="flex items-center gap-2">
        <FaTimes style={{ color: "var(--danger)", fontSize: "12px" }} />
        <span style={{ color: "var(--modal-text)" }}>
          {t(language, "已刪除: ", "Deleted: ")}
          <span className="font-medium">{input?.title || t(language, "提醒", "Reminder")}</span>
        </span>
      </div>
    </Card>
  );
}

function SnoozeReminderCard({ result, language }) {
  const r = result.reminder;
  const mins = result.snoozedMinutes;
  return (
    <Card accent="amber">
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ fontSize: "14px" }}>⏰</span>
        <span className="font-medium" style={{ color: "var(--modal-text)" }}>
          {t(language, `已延後 ${mins} 分鐘`, `Snoozed ${mins} minutes`)}
        </span>
      </div>
      {r && <ReminderRow reminder={r} language={language} />}
    </Card>
  );
}

function BatchCreateCard({ result, language }) {
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

function FindConflictsCard({ result, language }) {
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
                {formatDate(time, language)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function AnalyzePatternsCard({ result, language }) {
  const a = result.analysis || {};
  return (
    <Card accent="default">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: "14px" }}>📊</span>
        <span className="font-semibold text-sm" style={{ color: "var(--modal-text)" }}>
          {t(language, "模式分析", "Pattern Analysis")}
        </span>
        <span className="rounded-full px-2 py-0.5 ml-auto"
          style={{ fontSize: "10px", color: "var(--modal-text-muted)", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {result.period}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {a.totalReminders !== undefined && (
          <StatBox label={t(language, "總數", "Total")} value={a.totalReminders} />
        )}
        {a.averagePerWeek !== undefined && (
          <StatBox label={t(language, "週均", "Avg/Week")} value={a.averagePerWeek} />
        )}
        {a.completionRate !== undefined && (
          <StatBox label={t(language, "完成率", "Completion")} value={a.completionRate} />
        )}
        {a.byCategory && Object.entries(a.byCategory).map(([cat, count]) => (
          <StatBox key={cat} label={cat} value={count} />
        ))}
      </div>
    </Card>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-md text-center py-2 px-1"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="font-bold text-base" style={{ color: "var(--modal-text)" }}>{value}</div>
      <div style={{ fontSize: "10px", color: "var(--modal-text-muted)" }}>{label}</div>
    </div>
  );
}

function SummarizeUpcomingCard({ result, language }) {
  const groups = result.summary || {};
  const entries = Object.entries(groups);

  return (
    <Card accent="default">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm" style={{ color: "var(--modal-text)" }}>
          {t(language, "即將到來", "Upcoming")}
        </span>
        <span className="rounded-full px-2 py-0.5"
          style={{ fontSize: "11px", color: "var(--modal-text-muted)", background: "var(--modal-accent-light)" }}>
          {result.total} {t(language, "個任務", "tasks")}
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="text-center py-3" style={{ color: "var(--modal-text-muted)" }}>
          {t(language, "沒有即將到來的任務", "No upcoming tasks")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.slice(0, 5).map(([group, items]) => (
            <div key={group}>
              <div className="font-medium mb-1" style={{ fontSize: "11px", color: "var(--modal-text-secondary)" }}>
                {group} ({items.length})
              </div>
              <div className="flex flex-col gap-1">
                {items.slice(0, 3).map((r, i) => <ReminderRow key={i} reminder={r} language={language} />)}
                {items.length > 3 && (
                  <div style={{ fontSize: "10px", color: "var(--modal-text-muted)", paddingLeft: "12px" }}>
                    +{items.length - 3} {t(language, "個更多", "more")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SuggestRemindersCard({ result, language }) {
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

function ExportRemindersCard({ result, language }) {
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

function QuickReminderCard({ result, language }) {
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

function TemplateCreateCard({ result, language }) {
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

function AskClarificationCard({ result, language }) {
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

function SearchWebCard({ result, language }) {
  const r = result.results?.[0];
  if (!r) return null;
  return (
    <Card accent="default">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: "14px" }}>🌐</span>
        <span className="font-semibold text-sm" style={{ color: "var(--modal-text)" }}>
          {t(language, "搜尋結果", "Search Results")}
        </span>
      </div>
      <div className="rounded-md p-2.5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div style={{ fontSize: "12px", color: "var(--modal-text-secondary)", lineHeight: "1.5" }}>
          {r.snippet?.length > 300 ? r.snippet.slice(0, 300) + "..." : r.snippet}
        </div>
      </div>
      {r.citations?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.citations.slice(0, 3).map((url, i) => {
            let domain;
            try { domain = new URL(url).hostname.replace("www.", ""); } catch { domain = url; }
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="rounded-full px-2 py-0.5 inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ fontSize: "10px", color: "var(--primary)", background: "var(--modal-accent-light)", border: "1px solid var(--modal-accent-border)" }}>
                [{i + 1}] {domain}
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ErrorCard({ error, tool, language }) {
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

// ---- Main export ----

export default function ToolResultCard({ tool, result, input, success, error, language = "zh" }) {
  // Error state
  if (!success || error) {
    return <ErrorCard error={error || result?.error} tool={tool} language={language} />;
  }

  if (!result) return null;

  switch (tool) {
    case "listReminders":
      return <ListRemindersCard result={result} language={language} />;
    case "createReminder":
      return <CreateReminderCard result={result} language={language} />;
    case "updateReminder":
      return <UpdateReminderCard result={result} language={language} />;
    case "deleteReminder":
      return <DeleteReminderCard input={input} language={language} />;
    case "snoozeReminder":
      return <SnoozeReminderCard result={result} language={language} />;
    case "batchCreate":
      return <BatchCreateCard result={result} language={language} />;
    case "findConflicts":
      return <FindConflictsCard result={result} language={language} />;
    case "analyzePatterns":
      return <AnalyzePatternsCard result={result} language={language} />;
    case "summarizeUpcoming":
      return <SummarizeUpcomingCard result={result} language={language} />;
    case "suggestReminders":
      return <SuggestRemindersCard result={result} language={language} />;
    case "exportReminders":
      return <ExportRemindersCard result={result} language={language} />;
    case "setQuickReminder":
      return <QuickReminderCard result={result} language={language} />;
    case "templateCreate":
      return <TemplateCreateCard result={result} language={language} />;
    case "askClarification":
      return <AskClarificationCard result={result} language={language} />;
    case "searchWeb":
      return <SearchWebCard result={result} language={language} />;
    default:
      // Generic success card for unknown tools
      return (
        <Card accent="green">
          <div className="flex items-center gap-2">
            <FaCheck style={{ color: "var(--success)", fontSize: "12px" }} />
            <span style={{ color: "var(--modal-text)" }}>{tool}: {t(language, "已完成", "Completed")}</span>
          </div>
        </Card>
      );
  }
}
