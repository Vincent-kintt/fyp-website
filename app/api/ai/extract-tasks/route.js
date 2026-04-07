import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getModel } from "@/lib/ai/provider.js";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

const MAX_INPUT_LENGTH = 8000;
const EXTRACT_MODEL = process.env.PARSE_TASK_MODEL || "x-ai/grok-4.1-fast";

const taskElementSchema = z.object({
  title: z.string(),
  dateTime: z.string().nullable().default(null),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  tags: z.array(z.string()).default([]),
});

/**
 * Attempt to salvage task array from raw text (fallback when Output.array fails).
 * Strip code fences, JSON.parse, filter/sanitize each task.
 */
function salvageTasksFromText(rawText) {
  if (!rawText) return [];
  try {
    let jsonString = rawText.trim();
    const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonString = fenceMatch[1];

    const parsed = JSON.parse(jsonString);
    const tasks = Array.isArray(parsed) ? parsed : [];

    return tasks
      .filter((t) => t.title && typeof t.title === "string")
      .map((t) => ({
        title: t.title.trim(),
        dateTime: typeof t.dateTime === "string" ? t.dateTime : null,
        priority: ["high", "medium", "low"].includes(t.priority)
          ? t.priority
          : "medium",
        tags: Array.isArray(t.tags)
          ? t.tags
              .filter((tag) => typeof tag === "string")
              .map((tag) => tag.toLowerCase().trim())
          : [],
      }));
  } catch {
    return [];
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

    const { text, language = "zh", confirmedTasks = [] } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: "Text is required" },
        { status: 400 },
      );
    }

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
        model: getModel(EXTRACT_MODEL),
        output: Output.array({ element: taskElementSchema }),
        system: systemPrompt,
        prompt: input,
        temperature: 0.2,
        maxTokens: 1000,
      });
      tasks = result.output ?? [];
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.warn(
          "[extract-tasks] Structured output failed, salvaging from text",
        );
        tasks = salvageTasksFromText(error.text);
      } else {
        throw error;
      }
    }

    // Sanitize tags (lowercase trim) — structured output gives raw values
    const validTasks = tasks
      .filter((t) => t.title && typeof t.title === "string")
      .map((t) => ({
        title: t.title.trim(),
        dateTime: typeof t.dateTime === "string" ? t.dateTime : null,
        priority: ["high", "medium", "low"].includes(t.priority)
          ? t.priority
          : "medium",
        tags: Array.isArray(t.tags)
          ? t.tags
              .filter((tag) => typeof tag === "string")
              .map((tag) => tag.toLowerCase().trim())
          : [],
      }));

    return NextResponse.json({
      success: true,
      data: { tasks: validTasks, truncated },
    });
  } catch (error) {
    console.error("[extract-tasks] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
