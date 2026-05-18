// Format a Date into the wall-clock string `<input type="datetime-local">`
// expects (`YYYY-MM-DDTHH:mm`) using LOCAL parts. The H7 fix converts the
// returned string back to UTC via `naiveToUTC(value, userTimezone)` on
// submit — see `lib/forms/reminderSubmitPayload.js`. This helper has no
// timezone awareness on its own: it is purely a Date → input-string adapter.
export function toLocalDateTimeString(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
