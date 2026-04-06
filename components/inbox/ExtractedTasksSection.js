"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ExtractedTaskCard from "./ExtractedTaskCard";

export default function ExtractedTasksSection({
  tasks,
  onConfirm,
  onConfirmAll,
  onDismiss,
}) {
  const t = useTranslations("inbox");
  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    try {
      await onConfirmAll();
    } finally {
      setConfirmingAll(false);
    }
  };

  if (!tasks || tasks.length === 0) return null;

  return (
    <div
      className="px-6 py-4"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)", letterSpacing: "0.5px" }}
        >
          {t("extractedTasks")}
        </span>
        <button
          onClick={handleConfirmAll}
          disabled={confirmingAll}
          className="px-3 py-1 rounded-md text-xs transition-colors disabled:opacity-50"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {t("confirmAll")}
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {tasks.map((task, index) => (
          <ExtractedTaskCard
            key={`${task.title}-${index}`}
            task={task}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}
