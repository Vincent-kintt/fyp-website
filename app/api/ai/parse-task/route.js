import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeTags } from "@/lib/utils";
import { getModel } from "@/lib/ai/provider.js";
import { generateText } from "ai";
import * as chrono from "chrono-node";
import { computeOverallConfidence } from "./confidence.js";

const PARSE_MODEL = process.env.PARSE_TASK_MODEL || "x-ai/grok-4.1-fast";

// Custom chrono parser with smart AM/PM inference
// When time is ambiguous (no AM/PM), assume PM for hours 1-6 (people rarely schedule at 1-6 AM)
const customChrono = chrono.casual.clone();
customChrono.refiners.push({
  refine: (context, results) => {
    results.forEach((result) => {
      // Only apply if meridiem (AM/PM) is not certain
      if (!result.start.isCertain("meridiem")) {
        const hour = result.start.get("hour");
        // Hours 1-6 without AM/PM -> assume PM (13:00-18:00)
        // This is because people rarely schedule tasks at 1-6 AM
        if (hour >= 1 && hour <= 6) {
          result.start.assign("meridiem", 1); // 1 = PM
          result.start.assign("hour", hour + 12);
        }
      }
    });
    return results;
  },
});

/**
 * POST /api/ai/parse-task
 * Lightweight NLP endpoint for Quick Add - extracts structured data from natural language
 * Returns parsed task data without creating the task
 */

/**
 * Parse date/time using chrono-node (reliable NLP date parsing)
 */
function parseDateTimeWithChrono(text, refDate, forceToday = false) {
  if (!text) return null;

  // Use custom parser with smart AM/PM inference
  // Disable forwardDate if user explicitly says "today" to prevent pushing to tomorrow
  const results = customChrono.parse(text, refDate, {
    forwardDate: !forceToday,
  });

  if (results.length === 0) return null;

  const parsed = results[0];
  const startDate = parsed.start.date();

  // Check if time was explicitly mentioned
  const hasTime = parsed.start.isCertain("hour");

  // If no time specified, default to 09:00
  if (!hasTime) {
    startDate.setHours(9, 0, 0, 0);
  }

  // Format as ISO string without seconds
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

    // HYBRID APPROACH: LLM Normalization + Deterministic Parsing
    // 1. LLM extracts intent and normalizes date string (e.g. "tmr" -> "tomorrow")
    // 2. Chrono parses the normalized date string reliably

    // Format current time for context
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

Extract structured data from user input. Return JSON only:
{
  "title": "Clean task title (remove date/time words)",
  "tags": ["relevant", "tags"],
  "priority": "low/medium/high",
  "date_expression": "normalized English date/time for chrono-node parser",
  "is_task": true,
  "matched_text": "exact substring from input"
}

**Date/Time Rules:**
- Normalize all dates to English (e.g., "tmr" -> "tomorrow", "下週二" -> "next Tuesday")
- ALWAYS include AM/PM based on context. Use current time to infer:
  - If it's now ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}, and user says "today 10:00", pick the next logical 10:00 (AM if before 10am, PM if after 10am)
  - Ambiguous times like "4:30" without AM/PM → use PM for typical task hours (1-6)
- Format: "today at 4:30 pm", "tomorrow at 9:00 am", "next Friday at 2:00 pm"

**Priority:** HIGH for urgent/ASAP/deadline, LOW for whenever/maybe, MEDIUM default.

Also determine:
- "is_task": true if the input contains a clear actionable task (something to do, schedule, or complete). false if it's just a note, observation, thought, or informational text like "the weather is nice" or "I feel tired".
- "matched_text": the exact verbatim substring from the input that represents the task. Must appear in the original input unchanged.

Examples:
- "meeting tmr 2pm" -> {"title": "Meeting", "tags": ["work"], "priority": "medium", "date_expression": "tomorrow at 2:00 pm", "is_task": true, "matched_text": "meeting tmr 2pm"}
- "the weather is nice today" -> {"title": "", "tags": [], "priority": "medium", "date_expression": "", "is_task": false, "matched_text": ""}
- "今天10點開會" -> {"title": "開會", "tags": ["work"], "priority": "medium", "date_expression": "today at 10:00 am/pm", "is_task": true, "matched_text": "今天10點開會"} (pick based on current time)`;

    const { text: content } = await generateText({
      model: getModel(PARSE_MODEL),
      system: systemPrompt,
      prompt: text,
      temperature: 0.2,
      maxTokens: 300,
    });

    if (!content) {
      throw new Error("No content in LLM response");
    }

    // Extract JSON from response
    let jsonString = content.trim();
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

    let llmParsed;
    try {
      llmParsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("[parse-task] JSON parse error:", jsonString);
      llmParsed = { title: text.trim() };
    }

    // Detect if user explicitly said "today"
    const isToday =
      llmParsed.is_today === true ||
      /\b(today|今天|今日|2day|tdy)\b/i.test(text);

    // Parse the normalized date expression with Chrono
    let chronoResult = null;
    if (llmParsed.date_expression) {
      chronoResult = parseDateTimeWithChrono(
        llmParsed.date_expression,
        now,
        isToday,
      );
    }

    // Fallback: If LLM missed the date but Chrono can find something in the original text
    if (!chronoResult) {
      const fallbackResult = parseDateTimeWithChrono(text, now, isToday);
      if (fallbackResult) {
        chronoResult = fallbackResult;
      }
    }

    // isTask — default false if LLM didn't return it (non-authoritative)
    const isTask = llmParsed.is_task === true;

    // matchedText — the LLM's identified task substring
    const matchedText = llmParsed.matched_text || text;

    // Construct final result
    const confidence = {
      title: 0.9,
      tags: llmParsed.tags?.length > 0 ? 0.8 : 0.5,
      priority: 0.7,
    };

    // Add dateTime confidence from chrono if parsed successfully
    if (chronoResult) {
      confidence.dateTime = chronoResult.confidence;
    }

    // Compute overall confidence
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
