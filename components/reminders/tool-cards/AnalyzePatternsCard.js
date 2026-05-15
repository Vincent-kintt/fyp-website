"use client";

import { Card, t } from "./shared";

function StatBox({ label, value }) {
  return (
    <div className="rounded-md text-center py-2 px-1"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="font-bold text-base" style={{ color: "var(--modal-text)" }}>{value}</div>
      <div style={{ fontSize: "10px", color: "var(--modal-text-muted)" }}>{label}</div>
    </div>
  );
}

export default function AnalyzePatternsCard({ result, language }) {
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
