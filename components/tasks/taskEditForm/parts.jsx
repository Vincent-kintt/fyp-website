// Presentational sub-components and the priority-color resolver extracted
// from TaskEditForm. Previously declared INSIDE the TaskEditForm function
// body, which recreated their identity on every render and caused React to
// remount every subtree. Moving them to module scope stops that churn
// without changing the visual output or props.

import { calculateEndTime } from "@/lib/utils";
import { getStatusIconComponent } from "@/components/reminders/statusIcons";

const PRIORITY_COLORS = {
  high: "border-red-500 bg-red-500/10 text-red-500",
  medium: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
  low: "border-green-500 bg-green-500/10 text-green-500",
};

export function getPriorityColor(priority) {
  return PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
}

const PRIORITY_DOT_COLORS = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2.5 pt-1 pb-0.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
        style={{ color: "var(--text-muted)" }}
      >
        {children}
      </span>
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: "var(--border, var(--card-border))" }}
      />
    </div>
  );
}

// Renders nothing unless BOTH dateTime and duration are present. The inline
// version closed over formData; the extracted version takes them as props so
// it's render-tree-stable.
export function EndTimePreview({ dateTime, duration }) {
  if (!dateTime || !duration) return null;
  const start = new Date(dateTime);
  const end = calculateEndTime(start, duration);
  const fmt = (d) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>
      {fmt(start)} → {fmt(end)}
    </span>
  );
}

export function PriorityDot({ level }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${PRIORITY_DOT_COLORS[level] || ""}`}
    />
  );
}

export function StatusIcon({ status, className }) {
  const Icon = getStatusIconComponent(status);
  return <Icon className={className} />;
}
