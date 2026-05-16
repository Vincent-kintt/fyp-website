import { normalizeTags } from "@/lib/utils";

const VALID_PRIORITIES = ["high", "medium", "low"];

/**
 * Sanitize a raw array of LLM-extracted tasks into the shape returned to the
 * client. Filters out entries without a string title and normalizes tags via
 * the canonical `normalizeTags`, so the inbox preview matches what
 * `/api/reminders` will ultimately persist (otherwise the user confirms
 * "front end" but storage shows "front-end").
 *
 * Used by both the structured-output happy path and the salvage path in
 * `app/api/ai/extract-tasks/route.js`.
 *
 * @param {unknown} rawTasks - Whatever the LLM returned (array or salvage parse).
 * @returns {Array<{ title: string, dateTime: string | null, priority: "high" | "medium" | "low", tags: string[] }>}
 */
export function sanitizeExtractedTasks(rawTasks) {
  if (!Array.isArray(rawTasks)) return [];

  return rawTasks
    .filter((t) => t && typeof t.title === "string" && t.title.trim().length > 0)
    .map((t) => ({
      title: t.title.trim(),
      dateTime: typeof t.dateTime === "string" ? t.dateTime : null,
      priority: VALID_PRIORITIES.includes(t.priority) ? t.priority : "medium",
      tags: normalizeTags(Array.isArray(t.tags) ? t.tags : []),
    }));
}
