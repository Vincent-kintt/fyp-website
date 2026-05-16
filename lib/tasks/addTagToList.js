import { normalizeTag } from "@/lib/utils";

/**
 * Compute the new tag list when a user submits a raw tag input.
 *
 * Normalizes via the canonical server `normalizeTag` so the chip preview
 * matches what the server will store (avoiding display/storage mismatches
 * and silently-dropped tags when the server filters out < 2-char tags).
 *
 * @param {string} rawTag - Raw user input (may include `#`, whitespace, mixed case).
 * @param {string[]} [existingTags=[]] - Current tag list on the task being edited.
 * @returns {string[] | null}
 *   - `null` when the input is invalid (caller should no-op state updates).
 *   - The same `existingTags` reference when the tag is a duplicate (caller can
 *     still clear the input field but skip the parent state update).
 *   - A new array `[...existingTags, normalized]` on a successful add.
 */
export function addTagToList(rawTag, existingTags = []) {
  const normalized = normalizeTag(rawTag);
  if (!normalized || normalized.length < 2) return null;
  if (existingTags.includes(normalized)) return existingTags;
  return [...existingTags, normalized];
}
