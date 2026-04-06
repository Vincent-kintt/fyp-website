import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeTags } from "@/lib/utils";
import { getModel } from "@/lib/ai/provider.js";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import * as chrono from "chrono-node";
import { computeOverallConfidence } from "./confidence.js";

const PARSE_MODEL = process.env.PARSE_TASK_MODEL || "x-ai/grok-4.1-fast";

const parseTaskSchema = z.object({
  title: z.string().default(""),
  tags: z.array(z.string()).default([]),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  date_expression: z.string().default(""),
  is_task: z.boolean().default(false),
  matched_text: z.string().default(""),
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

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { text, language = "zh" } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: "Text is required" },
        { status: 400 },
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Input too long" },
        { status: 400 },
      );
    }

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
- "matched_text": the exact verbatim substring from the input that represents the task. Must appear in the original input unchanged.`;

    let llmParsed;

    try {
      const result = await generateText({
        model: getModel(PARSE_MODEL),
        output: Output.object({ schema: parseTaskSchema }),
        system: systemPrompt,
        prompt: text,
        temperature: 0.2,
        maxTokens: 300,
      });
      llmParsed = result.output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.warn(
          "[parse-task] Structured output failed, salvaging from text",
        );
        llmParsed = salvageFromText(error.text);
      }
      if (!llmParsed) {
        console.error(
          "[parse-task] All parsing failed:",
          error.message || error,
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

    const confidence = {
      title: 0.9,
      tags: llmParsed.tags?.length > 0 ? 0.8 : 0.5,
      priority: 0.7,
    };

    if (chronoResult) {
      confidence.dateTime = chronoResult.confidence;
    }

    confidence.overall = computeOverallConfidence(confidence);

    const result = {
      title: llmParsed.title || text.trim(),
      tags: normalizeTags(llmParsed.tags || []),
      priority: llmParsed.priority || "medium",
      ...(chronoResult ? { dateTime: chronoResult.dateTime } : {}),
      isTask,
      matchedText,
      confidence,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[parse-task] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
