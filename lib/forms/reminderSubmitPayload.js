// Shared form-submission helpers for reminder forms (TaskEditForm, QuickAdd,
// QuickAddPopover, and any future form that POSTs / PATCHes a reminder).
// Extracted during the H7 follow-up so the naive-datetime → UTC conversion
// lives in ONE place and is exercised by ONE test suite.
//
// Background — the H7 bug, in 30 seconds:
//   `<input type="datetime-local">` (and parse-task's NLP response, and our
//   "end of today" default) yields a NAIVE wall-clock string like
//   `"2026-05-20T09:00"`. `new Date(naiveString).toISOString()` (the bad
//   pattern that lived in TaskEditForm AND QuickAdd) interprets that string
//   in the BROWSER's system timezone — wrong when the user's account TZ
//   differs from the machine they're physically using (HK account on a Mac
//   set to LA: up to 16 hours off, AND possibly the wrong calendar day).
//
// Fix: route every conversion through `naiveToUTC(value, userTimezone)`, the
// same helper the AI write paths use. Result depends ONLY on `userTimezone`,
// never on the runtime's TZ.

import { naiveToUTC } from "@/lib/ai/dateUtils";

/**
 * Build a reminder POST / PATCH payload from a form-state-shaped object,
 * converting the naive datetime to UTC via the user's IANA timezone.
 *
 * Shape-agnostic: every field in `formData` passes through untouched except
 * `dateTime`. Works for TaskEditForm (full PATCH body), QuickAdd (POST body
 * built from parsed + manual overrides), and QuickAddPopover (`{title,
 * dateTime, status}` minimal shape).
 *
 * @param {{
 *   formData: { dateTime?: string|null, [k: string]: unknown },
 *   userTimezone: string,
 * }} args
 * @returns {object} payload with `dateTime` as an ISO-8601 UTC string,
 *                   `null` when the form had no datetime, and every other
 *                   `formData` field passed through untouched.
 * @throws when `formData.dateTime` is non-empty but `userTimezone` is
 *         falsy — silently falling back to browser TZ IS the bug this
 *         helper exists to prevent.
 */
export function buildSubmitPayload({ formData, userTimezone }) {
  const submitData = { ...formData };
  if (!submitData.dateTime) {
    submitData.dateTime = null;
    return submitData;
  }
  if (!userTimezone) {
    // Refusing to silently use browser TZ — that's the H7 bug. Call sites
    // are responsible for resolving a timezone (account setting → browser
    // default with console.warn) BEFORE calling this helper.
    throw new Error(
      "buildSubmitPayload: userTimezone is required when formData.dateTime is set",
    );
  }
  const utc = naiveToUTC(submitData.dateTime, userTimezone);
  // naiveToUTC returns null for unparseable input; surface as null so the
  // server validation can reject it explicitly rather than us silently
  // sending Invalid Date.toISOString() (which throws).
  submitData.dateTime = utc ? utc.toISOString() : null;
  return submitData;
}

/**
 * Compute "end of today in the user's timezone" as a naive datetime string
 * (`YYYY-MM-DDT23:59`), suitable for feeding back through `buildSubmitPayload`.
 *
 * QuickAdd uses this as a default when neither the AI parser nor the manual
 * override supplied a dateTime: the new task lands in the "Today" section
 * but isn't immediately overdue. Previously implemented as
 * `new Date(); setHours(23,59); toISOString()` — wrong on TWO axes: the
 * 23:59 wall-time was the browser's, not the user's, AND "today" might be a
 * different calendar day in the user's TZ vs. the machine clock.
 *
 * @param {string} userTimezone — IANA timezone, must be truthy.
 * @param {Date} [now=new Date()] — current instant; injectable for tests.
 * @returns {string} naive datetime string `"YYYY-MM-DDT23:59"` representing
 *                   23:59 on whatever calendar day `now` corresponds to in
 *                   `userTimezone`.
 * @throws when `userTimezone` is falsy.
 */
export function endOfDayNaiveInTz(userTimezone, now = new Date()) {
  if (!userTimezone) {
    throw new Error("endOfDayNaiveInTz: userTimezone is required");
  }
  // Read out the calendar parts AS THEY APPEAR in the user's TZ, not the
  // server / browser TZ. We only need year/month/day — the time is fixed at
  // 23:59 by definition.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: userTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const g = (type) => parts.find((p) => p.type === type).value;
  return `${g("year")}-${g("month")}-${g("day")}T23:59`;
}
