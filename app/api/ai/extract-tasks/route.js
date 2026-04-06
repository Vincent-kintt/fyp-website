import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getModel } from "@/lib/ai/provider.js";
import { generateText } from "ai";

const MAX_INPUT_LENGTH = 8000;

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

Return a JSON array of tasks. Each task:
{
  "title": "Clean, concise task title in ${lang}",
  "dateTime": "ISO format YYYY-MM-DDTHH:mm or null if no date mentioned",
  "priority": "high" | "medium" | "low",
  "tags": ["relevant", "tags"]
}

Rules:
- Extract ONLY actionable items (things to do, schedule, complete, buy, submit, etc.)
- Skip observations, notes, context, thoughts
- Normalize dates relative to current time. "tomorrow" = next day. "next week" = next Monday.
- For ambiguous times (no AM/PM), use PM for hours 1-6
- If no date/time is mentioned, set dateTime to null
- Priority: HIGH for urgent/deadline/ASAP, LOW for whenever/maybe, MEDIUM default
- Tags: infer 1-2 relevant tags per task (e.g., "work", "school", "shopping", "social")
- If no tasks found, return empty array []
- Return ONLY the JSON array, no markdown fences, no explanation`;

    const { text: content } = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: input,
      temperature: 0.2,
      maxTokens: 1000,
    });

    if (!content) {
      return NextResponse.json({
        success: true,
        data: { tasks: [], truncated },
      });
    }

    // Parse JSON from response
    let tasks;
    try {
      let jsonString = content.trim();
      // Strip markdown code fences if present
      const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) jsonString = fenceMatch[1];

      tasks = JSON.parse(jsonString);
      if (!Array.isArray(tasks)) tasks = [];
    } catch {
      console.error("[extract-tasks] JSON parse error:", content);
      tasks = [];
    }

    // Validate and sanitize each task
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
