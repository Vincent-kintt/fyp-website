/**
 * Shared date formatters — each serves a different display context.
 */
import { format } from "date-fns";

// For ToolResultCard — bilingual, null-safe, guards epoch dates
export function formatDateCompact(dateTime, language = "en") {
  if (!dateTime) return language === "zh" ? "未設定" : "No date";
  const d = new Date(dateTime);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970)
    return language === "zh" ? "未設定" : "No date";
  return d.toLocaleDateString(language === "zh" ? "zh-TW" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// For GlobalSearch — short format, date-fns
export function formatDateShort(dateTime) {
  try {
    return format(new Date(dateTime), "MMM dd, hh:mm a");
  } catch {
    return "";
  }
}

// For reminders/[id] detail page and ReminderCard — full format with year
export function formatDateFull(dateTime) {
  return format(new Date(dateTime), "MMMM dd, yyyy 'at' hh:mm a");
}
