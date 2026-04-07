import { streamText, stepCountIs } from "ai";
import { getModel } from "@/lib/ai/provider.js";
import { createRssTools } from "@/lib/ai/rssTools.js";
import { auth } from "@/auth";
import {
  acquireNoteAILock,
  releaseNoteAILock,
} from "@/lib/ai/notesConcurrency.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRssSystemPrompt({ language }) {
  const lang = language === "zh" ? "繁體中文" : "English";

  return `You are an RSS feed summarizer embedded in a notes editor. Your job is to fetch the user's RSS subscriptions, retrieve today's articles, and produce a concise news digest.

Instructions:
1. First call getUserSubscriptions to get the user's feed list.
2. Then call fetchRSSFeeds with all the feed URLs.
3. Produce a digest in ${lang}, grouped by category.
4. For each article: include the title as a Markdown link, followed by a 1-2 sentence summary.
5. If a feed returned no articles today, note that briefly.
6. If a feed failed to load, mention the error briefly and move on.
7. Keep the output concise and scannable — it will be inserted into a note.
8. Do not include any preamble or explanation — start directly with the digest content.`;
}

function computeDateBounds(timezone) {
  const tz = timezone || "Asia/Hong_Kong";
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = formatter.format(now);
  const todayStart = new Date(`${dateStr}T00:00:00`).toISOString();
  const todayEnd = new Date(`${dateStr}T23:59:59`).toISOString();
  return { todayStart, todayEnd };
}

export async function POST(request) {
  const session = await auth();

  if (!session?.user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const userId = session.user.id;

  if (!acquireNoteAILock(userId)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "An AI request is already in progress",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { language = "zh", timezone } = await request.json();
    const { todayStart, todayEnd } = computeDateBounds(timezone);
    const notesModel =
      process.env.NOTES_AGENT_MODEL || process.env.LLM_MODEL;
    const tools = createRssTools(userId, todayStart, todayEnd);

    const result = streamText({
      model: getModel(notesModel),
      system: getRssSystemPrompt({ language }),
      messages: [
        {
          role: "user",
          content: "Fetch my RSS subscriptions and create today's news digest.",
        },
      ],
      tools,
      stopWhen: stepCountIs(5),
      maxRetries: 2,
      abortSignal: request.signal,
      onStepFinish: ({ usage, toolResults }) => {
        console.log(
          JSON.stringify({
            event: "rss_agent_step",
            inputTokens: usage?.promptTokens,
            outputTokens: usage?.completionTokens,
            toolCalls: toolResults?.length || 0,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      onFinish: ({ totalUsage, steps }) => {
        releaseNoteAILock(userId);
        console.log(
          JSON.stringify({
            event: "rss_agent_complete",
            totalSteps: steps.length,
            totalInputTokens: totalUsage?.promptTokens,
            totalOutputTokens: totalUsage?.completionTokens,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      onError: ({ error }) => {
        releaseNoteAILock(userId);
        console.error(
          JSON.stringify({
            event: "rss_agent_error",
            message: error.message,
            timestamp: new Date().toISOString(),
          }),
        );
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    releaseNoteAILock(userId);
    console.error("POST /api/ai/notes-rss error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
