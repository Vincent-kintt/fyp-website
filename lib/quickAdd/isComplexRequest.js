/**
 * Predicate deciding when a QuickAdd input should bypass the lightweight
 * NLP parser and escalate to the full AI modal. Extracted from QuickAdd.jsx
 * so the pattern list is unit-testable and can be localised in a follow-up.
 *
 * EN patterns only today; ZH patterns are a future enhancement.
 */
export const COMPLEX_PATTERNS =
  /\b(plan|reschedule|move all|help me|check conflicts|reorganize|analyze|summarize|review|suggest)\b/i;

export function isComplexRequest(text) {
  if (!text) return false;
  if (text.length > 80) return true;
  return COMPLEX_PATTERNS.test(text);
}
