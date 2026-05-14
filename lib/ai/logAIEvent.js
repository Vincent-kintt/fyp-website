// Structured JSON logger for AI route lifecycle callbacks
// (onStepFinish / onFinish / onError).
//
// Keeps the logging shape consistent across routes without packaging
// stream lifecycle, lock release, or response handling — those stay
// in each route so the control flow remains visible at the call site.

export function logAIEvent(event, fields = {}, level = "log") {
  // Spread `fields` first so caller-supplied `event`/`timestamp` keys
  // cannot accidentally override the structured fields.
  const payload = { ...fields, event, timestamp: new Date().toISOString() };
  const sink = level === "error" ? console.error : console.log;
  sink(JSON.stringify(payload));
}
