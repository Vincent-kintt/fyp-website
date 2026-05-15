"use client";

import { Card, ReminderRow, t } from "./shared";

export default function SummarizeUpcomingCard({ result, language }) {
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
