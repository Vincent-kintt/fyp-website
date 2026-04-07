"use client";

import { format } from "date-fns";

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

  // Overlap layout
  const overlapping = totalColumns > 1;
  const positionStyle = overlapping
    ? {
        left: `${(column / totalColumns) * 100}%`,
        width: `${(1 / totalColumns) * 100 - 1}%`,
      }
    : { left: "2px", width: "calc(100% - 4px)" };

  function handleClick(e) {
    e.stopPropagation();
    onClick?.(reminder.id);
  }

  function handleCheckbox(e) {
    e.stopPropagation();
    onToggleComplete?.(reminder.id, !isCompleted);
  }

  const showTime = height >= 44 && reminder.dateTime;
  let timeLabel = "";
  if (showTime) {
    try {
      timeLabel = format(new Date(reminder.dateTime), "h:mm a");
    } catch {
      /* skip */
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={reminder.title}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick(e)}
      className="absolute overflow-hidden cursor-pointer select-none transition-shadow duration-150 hover:shadow-lg"
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 28)}px`,
        ...positionStyle,
        background: "var(--event-bg)",
        borderLeft: "3px solid var(--event-border)",
        borderRadius: "6px",
        opacity: isCompleted ? 0.45 : 1,
        zIndex: 2,
      }}
    >
      <div className="flex items-start gap-1.5 px-2 py-1 h-full">
        {isTask && (
          <span
            role="checkbox"
            aria-checked={isCompleted}
            onClick={handleCheckbox}
            onKeyDown={(e) => e.key === " " && handleCheckbox(e)}
            tabIndex={0}
            className="flex-shrink-0 mt-[3px] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect
                x="1"
                y="1"
                width="12"
                height="12"
                rx="3"
                stroke="var(--event-border)"
                strokeWidth="1.5"
                fill={isCompleted ? "var(--event-border)" : "none"}
              />
              {isCompleted && (
                <path
                  d="M4 7l2 2 4-4"
                  stroke="#fff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </span>
        )}

        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <span
            className="text-[12px] font-semibold leading-snug truncate"
            style={{
              color: "var(--event-text)",
              textDecoration: isCompleted ? "line-through" : "none",
            }}
          >
            {reminder.title}
          </span>
          {showTime && (
            <span
              className="text-[10px] leading-none tabular-nums"
              style={{ color: "var(--event-text)", opacity: 0.6 }}
            >
              {timeLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
