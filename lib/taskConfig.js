/**
 * Shared task configuration — single source of truth for category colors and priority config.
 */

const CATEGORY_COLORS = {
  work:     { base: "bg-primary-light text-primary",     border: "border-primary/30" },
  personal: { base: "bg-success-light text-success",     border: "border-success/30" },
  health:   { base: "bg-danger-light text-danger",       border: "border-danger/30" },
  other:    { base: "bg-background-tertiary text-text-secondary", border: "border-border" },
};

export function getCategoryColor(category, { withBorder = false } = {}) {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return withBorder ? `${c.base} ${c.border}` : c.base;
}

export const PRIORITY = {
  high: {
    label: "High",
    labelZh: "高",
    dotColor: "bg-danger",
    textColor: "text-danger",
    selectedBg: "bg-danger/8 border-danger/20",
    badgeClass: "bg-danger/15 text-danger border border-danger/30",
  },
  medium: {
    label: "Medium",
    labelZh: "中",
    dotColor: "bg-warning",
    textColor: "text-warning",
    selectedBg: "bg-warning/8 border-warning/20",
    badgeClass: "bg-warning/15 text-warning border border-warning/30",
  },
  low: {
    label: "Low",
    labelZh: "低",
    dotColor: "bg-success",
    textColor: "text-success",
    selectedBg: "bg-success/8 border-success/20",
    badgeClass: "bg-success/15 text-success border border-success/30",
  },
};

export function getPriority(level) {
  return PRIORITY[level] || PRIORITY.medium;
}
