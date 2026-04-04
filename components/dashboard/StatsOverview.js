"use client";

import { FaCheckCircle, FaClock, FaExclamationCircle } from "react-icons/fa";
import { useTranslations } from "next-intl";

export default function StatsOverview({ tasks }) {
  const t = useTranslations("stats");
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => !t.completed && new Date(t.dateTime) < new Date()).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-4" style={{ marginBottom: "var(--spacing-section)" }}>
      <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--card-border)] flex flex-col items-center justify-center text-center">
        <div className="text-success mb-1">
          <FaCheckCircle className="w-5 h-5" />
        </div>
        <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{completed}</div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("completed")}</div>
      </div>

      <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--card-border)] flex flex-col items-center justify-center text-center">
        <div className="text-primary mb-1">
          <FaClock className="w-5 h-5" />
        </div>
        <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{total - completed}</div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("pending")}</div>
      </div>

      <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--card-border)] flex flex-col items-center justify-center text-center">
        <div className="text-danger mb-1">
          <FaExclamationCircle className="w-5 h-5" />
        </div>
        <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{overdue}</div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("overdue")}</div>
      </div>
    </div>
  );
}
