"use client";

import { format } from "date-fns";

/**
 * AgendaCard — a single task/event card in the agenda list.
 *
 * Props:
 *   reminder          — the reminder object
 *   onToggleComplete  — (id, completed) => void
 *   onClick           — (id) => void
 */
export default function AgendaCard({ reminder, onToggleComplete, onClick }) {
  const isTask = !reminder.type || reminder.type === "one-time";
  const isCompleted = reminder.status === "completed" || reminder.completed;

  const borderStyle = isTask ? "dashed" : "solid";

  let timeLabel = "";
  try {
    timeLabel = format(new Date(reminder.dateTime), "h:mm a");
  } catch {
    timeLabel = "";
  }

  let durationLabel = "";
  if (reminder.duration != null && reminder.duration > 0) {
    if (reminder.duration >= 60) {
      durationLabel = `${Math.round(reminder.duration / 60)}h`;
    } else {
      durationLabel = `${reminder.duration}m`;
    }
  }

  function handleClick() {
    onClick?.(reminder.id);
  }

  function handleCheckboxClick(e) {
    e.stopPropagation();
    onToggleComplete?.(reminder.id, !isCompleted);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={reminder.title}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className="flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-[var(--background)] select-none"
      style={{
        backgroundColor: "var(--card-bg)",
        borderLeft: `3px ${borderStyle} var(--event-border)`,
        opacity: isCompleted ? 0.5 : 1,
      }}
    >
      <div className="flex flex-col flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[15px] font-semibold leading-snug truncate"
            style={{
              color: "var(--text-primary)",
              textDecoration: isCompleted ? "line-through" : "none",
            }}
          >
            {reminder.title}
          </span>

          {/* Checkbox for tasks */}
          {isTask && (
            <span
              role="checkbox"
              aria-checked={isCompleted}
              tabIndex={0}
              onClick={handleCheckboxClick}
              onKeyDown={(e) => e.key === " " && handleCheckboxClick(e)}
              className="flex-shrink-0 cursor-pointer"
            >
              <span
                className="block w-4 h-4 rounded border"
                style={{
                  borderColor: "var(--event-border)",
                  backgroundColor: isCompleted
                    ? "var(--event-border)"
                    : "transparent",
                }}
              />
            </span>
          )}
        </div>

        {/* Time + duration */}
        {(timeLabel || durationLabel) && (
          <span
            className="text-[12px] leading-snug mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            {timeLabel}
            {timeLabel && durationLabel && " · "}
            {durationLabel}
          </span>
        )}
      </div>
    </div>
  );
}
