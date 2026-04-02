/**
 * Shared date formatters — each serves a different display context.
 * Functions accept an optional `locale` string ("zh-TW" | "en") and
 * use date-fns locale objects for localised output.
 */
import { format } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";

function getDateFnsLocale(locale) {
  return locale === "zh-TW" ? zhTW : enUS;
}

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
export function formatDateShort(dateTime, locale) {
  if (!dateTime) return "";
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return "";
    const dfLocale = getDateFnsLocale(locale);
    return locale === "zh-TW"
      ? format(d, "M月d日 HH:mm", { locale: dfLocale })
      : format(d, "MMM dd, hh:mm a", { locale: dfLocale });
  } catch {
    return "";
  }
}

// For ReminderCard — abbreviated month with year
export function formatDateMedium(dateTime, locale) {
  if (!dateTime) return "";
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return "";
    const dfLocale = getDateFnsLocale(locale);
    return locale === "zh-TW"
      ? format(d, "yyyy年M月d日 HH:mm", { locale: dfLocale })
      : format(d, "MMM dd, yyyy 'at' hh:mm a", { locale: dfLocale });
  } catch {
    return "";
  }
}

// For reminders/[id] detail page — full month with year
export function formatDateFull(dateTime, locale) {
  if (!dateTime) return "";
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return "";
    const dfLocale = getDateFnsLocale(locale);
    return locale === "zh-TW"
      ? format(d, "yyyy年M月d日 EEEE HH:mm", { locale: dfLocale })
      : format(d, "MMMM dd, yyyy 'at' hh:mm a", { locale: dfLocale });
  } catch {
    return "";
  }
}
