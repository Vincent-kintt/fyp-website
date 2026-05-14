// Shared timezone helpers for AI tools and prompt construction.
// Pure functions — no I/O, no SDK deps — so they can be imported anywhere
// (server routes, generated prompts, tests).

// Split a UTC Date into local-time { date, time } parts in the user's timezone.
// Returns { date: "YYYY-MM-DD", time: "HH:mm" }.
// If timezone is null/undefined, falls back to server local time.
// If the date is invalid, returns { date: "Invalid", time: "Invalid" }.
export function formatTimezoneParts(date, timezone) {
  if (isNaN(date.getTime())) return { date: "Invalid", time: "Invalid" };
  if (!timezone) {
    const pad = (n) => String(n).padStart(2, "0");
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t).value;
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    time: `${g("hour")}:${g("minute")}`,
  };
}

// Join the result of formatTimezoneParts into a single "YYYY-MM-DD HH:mm" string.
export function formatInTimezone(date, timezone) {
  if (isNaN(date.getTime())) return "Invalid date";
  const { date: d, time: t } = formatTimezoneParts(date, timezone);
  return `${d} ${t}`;
}

// Convert a naive datetime string in the user's timezone to a UTC Date (DST-safe).
// If the string already has a timezone designator (Z or +/-offset), parse it directly.
export function naiveToUTC(naiveStr, timezone) {
  if (!naiveStr) return null;
  // Already an absolute timestamp — parse directly, skip timezone math
  if (/Z|[+-]\d{2}:\d{2}/.test(naiveStr)) return new Date(naiveStr);
  if (!timezone) return new Date(naiveStr);
  const [datePart, timePart = "00:00"] = naiveStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, h, min));
  if (isNaN(utcGuess.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);
  const g = (type) => parseInt(parts.find((p) => p.type === type).value);
  const localAsUTC = Date.UTC(
    g("year"),
    g("month") - 1,
    g("day"),
    g("hour"),
    g("minute"),
  );
  return new Date(utcGuess.getTime() - (localAsUTC - utcGuess.getTime()));
}
