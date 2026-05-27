import { normalizeTags, REMINDER_CATEGORIES } from "@/lib/utils";
import { getModel, getParseModelId } from "@/lib/ai/provider.js";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import * as chrono from "chrono-node";
import { apiError, apiSuccess } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { nowAsWallClockIn } from "@/lib/ai/dateUtils.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";
import { consumeAILimit } from "@/lib/rateLimit/aiRateLimiter.js";
import { computeOverallConfidence } from "./confidence.js";

const parseTaskRequestSchema = z
  .object({
    text: z
      .string({ error: "Text is required" })
      .refine((v) => v.trim().length > 0, { message: "Text is required" })
      .refine((v) => v.length <= 2000, { message: "Input too long" }),
    language: z.string().optional(),
    timezone: z.string().optional(),
  });

const parseTaskSchema = z.object({
  title: z.string().default(""),
  tags: z.array(z.string()).default([]),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  date_expression: z.string().default(""),
  is_task: z.boolean().default(false),
  matched_text: z.string().default(""),
});

// Lenient schema for salvage path — .catch() falls back per-field instead of rejecting the whole object
const salvageSchema = z.object({
  title: z.string().catch(""),
  tags: z.array(z.string()).catch([]),
  priority: z.enum(["low", "medium", "high"]).catch("medium"),
  date_expression: z.string().catch(""),
  is_task: z.boolean().catch(false),
  matched_text: z.string().catch(""),
});

// Custom chrono parser with smart AM/PM inference
// When time is ambiguous (no AM/PM), assume PM for hours 1-6 (people rarely schedule at 1-6 AM)
const customChrono = chrono.casual.clone();
customChrono.refiners.push({
  refine: (context, results) => {
    results.forEach((result) => {
      if (!result.start.isCertain("meridiem")) {
        const hour = result.start.get("hour");
        if (hour >= 1 && hour <= 6) {
          result.start.assign("meridiem", 1);
          result.start.assign("hour", hour + 12);
        }
      }
    });
    return results;
  },
});

function parseDateTimeWithChrono(text, refDate, forceToday = false) {
  if (!text) return null;

  const results = customChrono.parse(text, refDate, {
    forwardDate: !forceToday,
  });

  if (results.length === 0) return null;

  const parsed = results[0];
  const startDate = parsed.start.date();
  const hasTime = parsed.start.isCertain("hour");

  if (!hasTime) {
    startDate.setHours(9, 0, 0, 0);
  }

  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  const day = String(startDate.getDate()).padStart(2, "0");
  const hours = String(startDate.getHours()).padStart(2, "0");
  const minutes = String(startDate.getMinutes()).padStart(2, "0");

  return {
    dateTime: `${year}-${month}-${day}T${hours}:${minutes}`,
    matchedText: parsed.text,
    confidence: hasTime ? 0.95 : 0.85,
  };
}

/**
 * Attempt to salvage structured data from raw text (fallback when Output.object fails).
 */
function salvageFromText(rawText) {
  if (!rawText) return null;
  try {
    let jsonString = rawText.trim();
    const codeBlockMatch = jsonString.match(
      /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
    );
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }
    return JSON.parse(jsonString);
  } catch {
    return null;
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
      parseTaskRequestSchema,
    );
    if (error) return error;
    const { text, language = "zh", timezone } = data;

    // Reference Date whose wall-clock parts match the user's local "now" (DST-aware via Intl).
    // Falls back to the server clock when the client omits `timezone`.
    const now =
      typeof timezone === "string" && timezone
        ? nowAsWallClockIn(timezone)
        : new Date();

    const currentTimeStr = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      ...(timezone ? { timeZone: timezone } : {}),
    });

    const systemPrompt = `You are a smart task parser. Current time: ${currentTimeStr}

Extract structured data from user input.

**Date/Time Rules:**
- Normalize all dates to English (e.g., "tmr" -> "tomorrow", "下週二" -> "next Tuesday")
- ALWAYS include AM/PM based on context. Use current time to infer:
  - If it's now ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}, and user says "today 10:00", pick the next logical 10:00 (AM if before 10am, PM if after 10am)
  - Ambiguous times like "4:30" without AM/PM -> use PM for typical task hours (1-6)
- Format: "today at 4:30 pm", "tomorrow at 9:00 am", "next Friday at 2:00 pm"

**Priority:** HIGH for urgent/ASAP/deadline, LOW for whenever/maybe, MEDIUM default.

**Rules:**
- "title": Clean task title with date/time words removed
- "date_expression": normalized English date/time string for a parser (empty string if no date)
- "is_task": true only if the input contains a clear actionable task. false for observations, notes, thoughts.
- "matched_text": the exact verbatim substring from the input that represents the task. Must appear in the original input unchanged.
- "tags": classify the task into the most relevant of: ${REMINDER_CATEGORIES.join(", ")}. Assign one (rarely two) only when clearly applicable. Leave empty [] if none clearly fit. Use these exact lowercase English values.`;

    let llmParsed;

    try {
      const result = await generateText({
        model: getModel(getParseModelId()),
        output: Output.object({ schema: parseTaskSchema }),
        system: systemPrompt,
        prompt: text,
        temperature: 0.2,
        maxTokens: 300,
        providerOptions: {
          openrouter: {
            reasoning: { enabled: false },
          },
        },
      });
      llmParsed = result.output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        logAIEvent("parse_task_structured_output_fallback", {
          route: "parse-task",
        });
        const salvaged = salvageFromText(error.text);
        if (salvaged) {
          llmParsed = salvageSchema.parse(salvaged);
        }
      }
      if (!llmParsed) {
        logAIEvent(
          "parse_task_failed",
          { route: "parse-task", message: error.message || String(error) },
          "error",
        );
        llmParsed = { title: text.trim() };
      }
    }

    const isToday =
      llmParsed.is_today === true ||
      /\b(today|今天|今日|2day|tdy)\b/i.test(text);

    let chronoResult = null;
    if (llmParsed.date_expression) {
      chronoResult = parseDateTimeWithChrono(
        llmParsed.date_expression,
        now,
        isToday,
      );
    }

    if (!chronoResult) {
      const fallbackResult = parseDateTimeWithChrono(text, now, isToday);
      if (fallbackResult) {
        chronoResult = fallbackResult;
      }
    }

    const isTask = llmParsed.is_task === true;
    const matchedText = llmParsed.matched_text || text;

    // Auto-classified tags, constrained to the canonical taxonomy. The LLM
    // prompt lists the categories as a hint; this filter is the source of
    // truth (out-of-taxonomy values like "shopping" are dropped).
    const tags = normalizeTags(llmParsed.tags || []).filter((tag) =>
      REMINDER_CATEGORIES.includes(tag),
    );

    const confidence = {
      title: 0.9,
      tags: tags.length > 0 ? 0.8 : 0.5,
      priority: 0.7,
    };

    if (chronoResult) {
      confidence.dateTime = chronoResult.confidence;
    }

    confidence.overall = computeOverallConfidence(confidence);

    const result = {
      title: llmParsed.title || text.trim(),
      tags,
      priority: llmParsed.priority || "medium",
      ...(chronoResult ? { dateTime: chronoResult.dateTime } : {}),
      isTask,
      matchedText,
      confidence,
    };

    return apiSuccess(result);
  },
  { label: "POST /api/ai/parse-task" },
);
