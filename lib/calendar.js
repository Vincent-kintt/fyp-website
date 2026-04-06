/**
 * Pure calendar helper functions — no React, no side effects.
 * Used by TimeGrid, DayView, WeekView, AgendaView, and tests.
 */
import { format, isSameDay, addDays, differenceInMinutes } from "date-fns";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const SLOT_HEIGHT = 48; // px per 30-min slot
export const HOUR_HEIGHT = 96; // px per hour (SLOT_HEIGHT * 2)
export const MIN_BLOCK_HEIGHT = 28; // minimum event block height in px
export const TIME_LABEL_WIDTH = 56; // px width of the left time label column
export const TOTAL_SLOTS = 48; // 24h * 2 slots/h

// ---------------------------------------------------------------------------
// getBlockTop
// ---------------------------------------------------------------------------

/**
 * Convert a dateTime string to a px offset from the top of the time grid.
 * e.g. "2026-04-07T09:30" → 9.5 * 96 = 912
 *
 * @param {string} dateTime  ISO datetime string ("YYYY-MM-DDTHH:mm")
 * @returns {number}  px offset
 */
export function getBlockTop(dateTime) {
  if (!dateTime) return 0;
  const d = new Date(dateTime);
  const hours = d.getHours() + d.getMinutes() / 60;
  return hours * HOUR_HEIGHT;
}

// ---------------------------------------------------------------------------
// getBlockHeight
// ---------------------------------------------------------------------------

/**
 * Convert a duration (minutes) to a px height.
 * null duration → one slot (48 px).
 * Very short durations → MIN_BLOCK_HEIGHT (28 px) so text stays readable.
 *
 * @param {number|null} duration  Minutes
 * @returns {number}  px height
 */
export function getBlockHeight(duration) {
  if (duration == null) return SLOT_HEIGHT;
  const raw = (duration / 30) * SLOT_HEIGHT;
  return Math.max(raw, MIN_BLOCK_HEIGHT);
}

// ---------------------------------------------------------------------------
// clipReminderToDay
// ---------------------------------------------------------------------------

/**
 * Given a reminder and a target date string, return the portion of the
 * reminder that falls on that day, in minutes from midnight.
 *
 * Handles:
 * - Same-day events (normal case)
 * - Events that start and end on the same day
 * - Events that cross midnight (clipped at 23:59 on start day, remainder on next day)
 * - Events on a completely different day → null
 *
 * @param {{ dateTime: string, duration: number|null }} reminder
 * @param {string} dateStr  Target date "YYYY-MM-DD"
 * @returns {{ startMinute: number, durationMinutes: number, clipped: boolean } | null}
 */
export function clipReminderToDay(reminder, dateStr) {
  if (!reminder.dateTime) return null;

  const start = new Date(reminder.dateTime);
  const duration = reminder.duration ?? 30; // default 30 min if unset
  const end = new Date(start.getTime() + duration * 60 * 1000);

  // Midnight boundaries of the target date
  const [year, month, day] = dateStr.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

  // No overlap with target day
  if (start > dayEnd || end <= dayStart) return null;

  const clippedStart = start < dayStart ? dayStart : start;
  const clippedEnd = end > dayEnd ? dayEnd : end;
  const clipped = start < dayStart || end > dayEnd;

  const startMinute =
    clippedStart.getHours() * 60 + clippedStart.getMinutes();
  const durationMinutes = Math.max(
    Math.round(differenceInMinutes(clippedEnd, clippedStart)),
    1
  );

  return { startMinute, durationMinutes, clipped };
}

// ---------------------------------------------------------------------------
// groupOverlappingReminders
// ---------------------------------------------------------------------------

/**
 * Assign side-by-side columns to overlapping reminders so they don't
 * visually cover each other.
 *
 * Two reminders overlap if their time ranges intersect.
 *
 * @param {Array<{ id: string, dateTime: string, duration: number|null }>} reminders
 * @returns {Map<string, { column: number, totalColumns: number }>}
 */
export function groupOverlappingReminders(reminders) {
  const result = new Map();
  if (!reminders || reminders.length === 0) return result;

  // Sort by start time, then by longer duration first
  const sorted = [...reminders]
    .filter((r) => r.dateTime)
    .sort((a, b) => {
      const ta = new Date(a.dateTime).getTime();
      const tb = new Date(b.dateTime).getTime();
      if (ta !== tb) return ta - tb;
      return (b.duration ?? 30) - (a.duration ?? 30);
    });

  // Each "group" is a list of reminders that all mutually overlap
  const groups = []; // groups[i] = [ reminder, ... ]

  for (const reminder of sorted) {
    const startA = new Date(reminder.dateTime).getTime();
    const durationA = reminder.duration ?? 30;
    const endA = startA + durationA * 60 * 1000;

    // Try to find an existing group that this reminder overlaps with
    let placed = false;
    for (const group of groups) {
      // Check if reminder overlaps with ANY member of this group
      const overlapsGroup = group.some((other) => {
        const startB = new Date(other.dateTime).getTime();
        const durationB = other.duration ?? 30;
        const endB = startB + durationB * 60 * 1000;
        return startA < endB && endA > startB;
      });

      if (overlapsGroup) {
        group.push(reminder);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([reminder]);
    }
  }

  // Assign columns within each group
  for (const group of groups) {
    const totalColumns = group.length;
    // Sort group by start time for deterministic column assignment
    const groupSorted = [...group].sort(
      (a, b) =>
        new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    );
    groupSorted.forEach((reminder, column) => {
      result.set(reminder.id, { column, totalColumns });
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// buildTasksByDate
// ---------------------------------------------------------------------------

/**
 * Group reminders by their calendar date for mini-calendar dot indicators
 * and agenda views.
 *
 * @param {Array<{ id: string, dateTime: string }>} reminders
 * @returns {{ [dateStr: string]: typeof reminders }}
 */
export function buildTasksByDate(reminders) {
  if (!Array.isArray(reminders)) return {};
  const map = {};
  for (const reminder of reminders) {
    if (!reminder.dateTime) continue;
    const dateStr = format(new Date(reminder.dateTime), "yyyy-MM-dd");
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(reminder);
  }
  return map;
}

// ---------------------------------------------------------------------------
// getRemindersForDate
// ---------------------------------------------------------------------------

/**
 * Filter reminders whose dateTime falls on the given Date.
 *
 * @param {Array<{ dateTime: string }>} reminders
 * @param {Date} date
 * @returns {typeof reminders}
 */
export function getRemindersForDate(reminders, date) {
  if (!Array.isArray(reminders) || !date) return [];
  return reminders.filter((r) => {
    if (!r.dateTime) return false;
    return isSameDay(new Date(r.dateTime), date);
  });
}

/**
 * Same as getRemindersForDate but excludes completed reminders.
 * Used by TimeGrid/DayView/WeekView where completed tasks should be hidden.
 */
export function getActiveRemindersForDate(reminders, date) {
  return getRemindersForDate(reminders, date).filter(
    (r) => r.status !== "completed" && !r.completed,
  );
}

// ---------------------------------------------------------------------------
// formatHourLabel
// ---------------------------------------------------------------------------

/**
 * Format an hour number as a display label.
 * "zh-TW" → "9:00" (24-hour), "en" → "9 AM" / "12 PM"
 *
 * @param {number} hour  0–23
 * @param {string} locale  "zh-TW" | "en"
 * @returns {string}
 */
export function formatHourLabel(hour, locale) {
  if (locale === "zh-TW") {
    return `${hour}:00`;
  }
  // English: 12-hour with AM/PM
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}
