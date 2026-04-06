"use client";

import { memo, useState } from "react";
import { Check, X } from "lucide-react";
import { getPriorityConfig } from "@/lib/utils";

const ExtractedTaskCard = memo(function ExtractedTaskCard({
  task,
  onConfirm,
  onDismiss,
}) {
  const [confirming, setConfirming] = useState(false);
  const priorityConfig = getPriorityConfig(task.priority);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(task);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
      style={{ backgroundColor: "var(--surface)" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--surface)")}
    >
      <div
        className="w-5 h-5 rounded-full flex-shrink-0"
        style={{
          border: `2px solid ${priorityConfig?.color || "var(--text-muted)"}`,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {task.title}
        </div>
        <div className="flex gap-2 mt-1 flex-wrap">
          {task.dateTime && (
            <span className="text-[11px]" style={{ color: "var(--primary)" }}>
              {task.dateTime}
            </span>
          )}
          {task.tags?.map((tag) => (
            <span
              key={tag}
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              #{tag}
            </span>
          ))}
          {task.priority !== "medium" && (
            <span
              className="text-[11px] font-medium"
              style={{
                color:
                  task.priority === "high"
                    ? "var(--danger)"
                    : "var(--text-muted)",
              }}
            >
              {task.priority}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--success)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
          aria-label="Confirm"
        >
          <Check size={16} strokeWidth={2} />
        </button>
        <button
          onClick={() => onDismiss(task)}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--danger)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
          aria-label="Dismiss"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
});

export default ExtractedTaskCard;
