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
      className="px-4 py-3"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)", letterSpacing: "0.5px" }}
        >
          {t("extractedTasks")}
        </span>
        <button
          onClick={handleConfirmAll}
          disabled={confirmingAll}
          className="px-2 py-0.5 rounded text-[10px] transition-colors disabled:opacity-50"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {t("confirmAll")}
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
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
