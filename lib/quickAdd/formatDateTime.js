/**
 * Format a datetime with relative labels: today / tomorrow / tomorrow +1 /
 * weekday-within-7-days / long-date. Pure — extracted from QuickAdd.jsx so
 * the formatter is directly unit-testable without rendering React.
 *
 * Previous closure captured `t` + `language` from the surrounding component;
 * they're explicit params now. `now` is injectable for tests.
 *
 * @param {string|null|undefined} dateTimeStr - ISO-ish datetime string.
 * @param {object} ctx
 * @param {(key: string) => string} ctx.t - i18n translation function.
 * @param {"en" | "zh"} ctx.language - locale variant; controls hour12 + Intl tag.
 * @param {Date} [ctx.now] - reference "now" (defaults to new Date()).
 * @returns {string|null} formatted label, or null when input is missing.
 */
export function formatDateTime(dateTimeStr, { t, language, now = new Date() }) {
  if (!dateTimeStr) return null;
  const date = new Date(dateTimeStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const targetDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const timeStr = date.toLocaleTimeString(
    language === "en" ? "en-US" : "zh-TW",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: language !== "en",
    },
  );

  if (targetDate.getTime() === today.getTime()) {
    return `${t("today")} ${timeStr}`;
  }
  if (targetDate.getTime() === tomorrow.getTime()) {
    return `${t("tomorrow")} ${timeStr}`;
  }
  if (targetDate.getTime() === dayAfterTomorrow.getTime()) {
    return `${t("tomorrow")} +1 ${timeStr}`;
  }

  if (targetDate < nextWeek) {
    const dayName = date.toLocaleDateString(
      language === "en" ? "en-US" : "zh-TW",
      { weekday: "long" },
    );
    return `${dayName} ${timeStr}`;
  }

  return date.toLocaleString(language === "en" ? "en-US" : "zh-TW", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
