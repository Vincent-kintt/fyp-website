import { streamText, stepCountIs } from "ai";
import { z } from "zod";
import { getModel, getNotesModelId } from "@/lib/ai/provider.js";
import { createRssTools } from "@/lib/ai/rssTools.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";
import { apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import {
  acquireUserAILock,
  releaseUserAILock,
} from "@/lib/locks/acquireUserAILock.js";
import { consumeAILimit } from "@/lib/rateLimit/aiRateLimiter.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notesRssSchema = z.object({
  language: z.string().optional(),
  timezone: z.string().optional(),
});

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

    const lockDoc = await acquireUserAILock(userId, "notes-ai");
    if (!lockDoc) {
      return apiError("An AI request is already in progress", 429);
    }

    let lockReleased = false;
    const releaseOnce = () => {
      if (lockReleased) return;
      lockReleased = true;
      // Fire-and-forget — stream-lifecycle callbacks are sync; the TTL index
      // guarantees the lock disappears even if this delete fails.
      releaseUserAILock(userId, "notes-ai").catch(() => {});
    };

    try {
      const { data, error: parseError } = await parseJsonBodyWithSchema(
        request,
        notesRssSchema,
      );
      if (parseError) {
        releaseOnce();
        return parseError;
      }
      const { language = "zh", timezone } = data;
      const { todayStart, todayEnd } = computeDateBounds(timezone);
      const tools = createRssTools(userId, todayStart, todayEnd);

      const result = streamText({
        model: getModel(getNotesModelId()),
        system: getRssSystemPrompt({ language }),
        messages: [
          {
            role: "user",
            content:
              "Fetch my RSS subscriptions and create today's news digest.",
          },
        ],
        tools,
        stopWhen: stepCountIs(10),
        maxRetries: 2,
        abortSignal: request.signal,
        onStepFinish: ({ usage, toolResults }) => {
          logAIEvent("rss_agent_step", {
            inputTokens: usage?.promptTokens,
            outputTokens: usage?.completionTokens,
            toolCalls: toolResults?.length || 0,
          });
        },
        onFinish: ({ totalUsage, steps }) => {
          releaseOnce();
          logAIEvent("rss_agent_complete", {
            totalSteps: steps.length,
            totalInputTokens: totalUsage?.promptTokens,
            totalOutputTokens: totalUsage?.completionTokens,
          });
        },
        onAbort: () => {
          releaseOnce();
          logAIEvent("rss_agent_aborted", {});
        },
        onError: ({ error }) => {
          releaseOnce();
          logAIEvent("rss_agent_error", { message: error.message }, "error");
        },
      });

      return result.toUIMessageStreamResponse();
    } catch (err) {
      // Synchronous error before stream — release lock before letting withAuth return 500
      releaseOnce();
      throw err;
    }
  },
  {
    label: "POST /api/ai/notes-rss",
    errorMessage: "Failed to process request",
  },
);
