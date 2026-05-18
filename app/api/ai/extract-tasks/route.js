import { getModel, getParseModelId } from "@/lib/ai/provider.js";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";
import { sanitizeExtractedTasks } from "@/lib/ai/extract-tasks-helpers.js";
import { consumeAILimit } from "@/lib/rateLimit/aiRateLimiter.js";

const MAX_INPUT_LENGTH = 8000;

const extractTasksRequestSchema = z.object({
  text: z
    .string({ error: "Text is required" })
    .refine((v) => v.trim().length > 0, { message: "Text is required" }),
  language: z.string().optional(),
  confirmedTasks: z.array(z.unknown()).optional(),
});

const taskElementSchema = z.object({
  title: z.string(),
  dateTime: z.string().nullable().default(null),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  tags: z.array(z.string()).default([]),
});

/**
 * Attempt to salvage a raw task array from the model's text output (fallback
 * when `Output.array` validation fails). Strips code fences then JSON.parses;
 * downstream `sanitizeExtractedTasks` filters and normalizes each task.
 */
function salvageTasksFromText(rawText) {
  if (!rawText) return [];
  try {
    let jsonString = rawText.trim();
    const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonString = fenceMatch[1];

    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const POST = withAuth(
  async ({ request, userId }) => {
    const limit = await consumeAILimit(userId);
    if (!limit.ok) {
      return apiError(
        `Rate limit exceeded. Try again in ${limit.retryAfterSeconds} seconds.`,
        429,
        null,
        { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const { data, error } = await parseJsonBodyWithSchema(
      request,
      extractTasksRequestSchema,
    );
    if (error) return error;
    const { text, language = "zh", confirmedTasks = [] } = data;

    const truncated = text.length > MAX_INPUT_LENGTH;
    const input = truncated ? text.slice(0, MAX_INPUT_LENGTH) : text;

    const now = new Date();
    const currentTimeStr = now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const lang = language === "zh" ? "Traditional Chinese" : "English";

    const systemPrompt = `You are a task extraction assistant. Current time: ${currentTimeStr}

Analyze the user's free-form text and extract all actionable tasks/to-dos. Ignore observations, thoughts, and non-actionable content.

Rules:
- Extract ONLY actionable items (things to do, schedule, complete, buy, submit, etc.)
- Skip observations, notes, context, thoughts
- Task titles should be in ${lang}
- Normalize dates relative to current time. "tomorrow" = next day. "next week" = next Monday.
- For ambiguous times (no AM/PM), use PM for hours 1-6
- If no date/time is mentioned, set dateTime to null
- Priority: HIGH for urgent/deadline/ASAP, LOW for whenever/maybe, MEDIUM default
- Tags: infer 1-2 relevant tags per task (e.g., "work", "school", "shopping", "social")
- If no tasks found, return empty array${confirmedTasks.length > 0 ? `\n\nIMPORTANT: The following tasks have ALREADY been created. Do NOT extract them again:\n${confirmedTasks.map((t) => `- ${t}`).join("\n")}` : ""}`;

    let tasks;

    try {
      const result = await generateText({
        model: getModel(getParseModelId()),
        output: Output.array({ element: taskElementSchema }),
        system: systemPrompt,
        prompt: input,
        temperature: 0.2,
        maxTokens: 1000,
      });
      tasks = result.output ?? [];
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        logAIEvent("extract_tasks_structured_output_fallback", {
          route: "extract-tasks",
        });
        tasks = salvageTasksFromText(error.text);
      } else {
        throw error;
      }
    }

    // Filter blanks and run tags through canonical normalizeTags so the
    // inbox preview matches what /api/reminders will store (otherwise the
    // user confirms e.g. "front end" but DB ends up with "front-end").
    const validTasks = sanitizeExtractedTasks(tasks);

    return apiSuccess({ tasks: validTasks, truncated });
  },
  { label: "POST /api/ai/extract-tasks" },
);
