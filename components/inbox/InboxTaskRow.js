"use client";

import { memo } from "react";
import { getPriorityConfig } from "@/lib/utils";

const InboxTaskRow = memo(function InboxTaskRow({ task, onToggleComplete, onClick }) {
  const priorityConfig = getPriorityConfig(task.priority);
  const tag = task.tags?.[0];
  const taskId = task.id || task._id;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(taskId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(taskId);
        }
      }}
      className="w-full text-left flex items-start gap-3 px-2 py-3 rounded-lg transition-colors cursor-pointer"
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.(taskId, !task.completed);
        }}
        className="mt-0.5 flex-shrink-0"
        aria-label="Toggle complete"
      >
        <div
          className={`w-5 h-5 rounded-full border-2 opacity-50 ${priorityConfig?.textColor || "text-text-muted"}`}
          style={{
            borderColor: "currentColor",
          }}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] truncate"
          style={{ color: "var(--text-primary)", lineHeight: 1.35 }}
        >
          {task.title}
        </div>
        {tag && (
          <span
            className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded ${priorityConfig?.badgeClass || ""}`}
          >
            {tag}
          </span>
        )}
      </div>
    </div>
  );
});

export default InboxTaskRow;
