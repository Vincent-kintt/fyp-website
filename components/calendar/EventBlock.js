"use client";

import { format } from "date-fns";

/**
 * EventBlock — a single timed reminder block rendered inside the TimeGrid.
 *
 * Absolutely positioned within its parent day-column.
 * Handles overlapping layout via `column` / `totalColumns`.
 */
export default function EventBlock({
  reminder,
  top,
  height,
  column = 0,
  totalColumns = 1,
  onClick,
  onToggleComplete,
}) {
  const isTask = !reminder.type || reminder.type === "one-time";
  const isCompleted = reminder.status === "completed" || reminder.completed;
  const isSnoozed = reminder.status === "snoozed";

  // ---------------------------------------------------------------------------
  // Layout — side-by-side columns for overlapping events
  // ---------------------------------------------------------------------------
  const overlapping = totalColumns > 1;
  const leftPercent = overlapping ? (column / totalColumns) * 100 : 0;
  const widthPercent = overlapping
    ? (1 / totalColumns) * 100 - 1
    : undefined;

  const positionStyle = overlapping
    ? {
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }
    : {
        left: "3px",
        width: "calc(100% - 6px)",
      };

  // ---------------------------------------------------------------------------
  // Colors via CSS vars
  // ---------------------------------------------------------------------------
  const borderStyle = isTask ? "dashed" : "solid";

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleClick(e) {
    e.stopPropagation();
    onClick?.(reminder.id);
  }

  function handleCheckboxClick(e) {
    e.stopPropagation();
    onToggleComplete?.(reminder.id, !isCompleted);
  }

  // ---------------------------------------------------------------------------
  // Time label (only shown when block is tall enough)
  // ---------------------------------------------------------------------------
  const showTime = height >= 40 && reminder.dateTime;
  let timeLabel = "";
  if (showTime) {
    try {
      timeLabel = format(new Date(reminder.dateTime), "h:mm a");
    } catch {
      timeLabel = "";
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={reminder.title}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick(e)}
      className="absolute overflow-hidden rounded transition-shadow cursor-pointer hover:shadow-md select-none"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        ...positionStyle,
        backgroundColor: "var(--event-bg)",
        borderLeft: `3px ${borderStyle} var(--event-border)`,
        color: "var(--event-text)",
        opacity: isCompleted ? 0.5 : 1,
      }}
    >
      <div className="flex items-start gap-1 px-1.5 pt-0.5 h-full overflow-hidden">
        {/* Checkbox for tasks */}
        {isTask && (
          <span
            role="checkbox"
            aria-checked={isCompleted}
            tabIndex={0}
            onClick={handleCheckboxClick}
            onKeyDown={(e) => e.key === " " && handleCheckboxClick(e)}
            className="flex-shrink-0 mt-[2px] cursor-pointer"
          >
            <span
              className="block w-3 h-3 rounded-sm border"
              style={{
                borderColor: "var(--event-border)",
                backgroundColor: isCompleted
                  ? "var(--event-border)"
                  : "transparent",
              }}
            />
          </span>
        )}

        <div className="flex flex-col min-w-0 flex-1">
          {/* Title */}
          <span
            className="text-[12px] font-semibold leading-tight truncate"
            style={{
              textDecoration: isCompleted ? "line-through" : "none",
            }}
          >
            {/* Snooze indicator */}
            {isSnoozed && (
              <span className="mr-1 opacity-70" aria-label="snoozed">
                ⏰
              </span>
            )}
            {reminder.title}
          </span>

          {/* Time label */}
          {showTime && (
            <span
              className="text-[10px] leading-tight truncate"
              style={{ opacity: 0.7 }}
            >
              {timeLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
