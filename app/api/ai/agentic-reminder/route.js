import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { getModel, getAgentModelId } from "@/lib/ai/provider.js";
import { createTools } from "@/lib/ai/tools.js";
import { getSystemPrompt } from "@/lib/ai/prompt.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";
import { trimMessagesKeepingToolPairs } from "@/lib/ai/trimMessages.js";
import { apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { ALLOWED_AGENT_MODELS } from "@/lib/ai/allowedModels.js";
import {
  acquireUserAILock,
  releaseUserAILock,
  renewUserAILock,
} from "@/lib/locks/acquireUserAILock.js";
import { consumeAILimit } from "@/lib/rateLimit/aiRateLimiter.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const agenticReminderSchema = z.object({
  // messages is loose because items pass through convertToModelMessages.
  messages: z.array(z.unknown()).min(1),
  // Enum (not z.string()) prevents a buggy/malicious client from requesting
  // an off-allowlist provider model (cost-control boundary — H9).
  model: z.enum(ALLOWED_AGENT_MODELS).optional(),
  reasoningEffort: z.string().optional(),
  language: z.string().optional(),
  userLocation: z.unknown().optional(),
});

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

    // Scope "reminder-ai" is separate from notes' "notes-ai" so reminder AI
    // and notes AI can stream concurrently for the same user. Two reminder
    // tabs, however, would race on double tool-driven writes — this serializes
    // them to one concurrent reminder agent stream per user.
    const lockDoc = await acquireUserAILock(userId, "reminder-ai");
    if (!lockDoc) {
      return apiError("An agent request is already in progress", 429);
    }

    // releaseOnce guards against double-release across the stream lifecycle
    // (onFinish + onError can both fire; onAbort fires when the client aborts).
    let lockReleased = false;
    const releaseOnce = () => {
      if (lockReleased) return;
      lockReleased = true;
      // Fire-and-forget — stream-lifecycle callbacks are sync; the TTL index
      // guarantees the lock disappears even if this delete fails.
      releaseUserAILock(userId, "reminder-ai").catch(() => {});
    };

    try {
      const { data, error } = await parseJsonBodyWithSchema(
        request,
        agenticReminderSchema,
      );
      if (error) {
        releaseOnce();
        return error;
      }
      const {
        messages: uiMessages,
        model,
        reasoningEffort = "medium",
        language = "zh",
        userLocation = null,
      } = data;

      const messages = await convertToModelMessages(uiMessages);

      const result = streamText({
        model: getModel(getAgentModelId(model)),
        system: getSystemPrompt({ language, userLocation }),
        messages,
        tools: createTools(userId, userLocation?.timezone),
        stopWhen: stepCountIs(10),
        maxRetries: 2,
        abortSignal: request.signal,
        prepareStep: async ({ messages: stepMessages }) => {
          if (stepMessages.length <= 30) return {};
          // keepFirst=1 preserves the system message; tailCount=20 keeps the
          // most recent exchange. The pair-aware helper expands the boundary
          // upward if a tool_result in the tail would otherwise lose its
          // tool_call — providers reject orphaned tool_results.
          return {
            messages: trimMessagesKeepingToolPairs({
              messages: stepMessages,
              keepFirst: 1,
              tailCount: 20,
            }),
          };
        },
        providerOptions: {
          openrouter: { reasoningEffort },
        },
        onStepFinish: ({ usage, toolResults }) => {
          // Heartbeat: extend the lease so a multi-step run that outlives the
          // lock TTL doesn't self-expire mid-stream. Fire-and-forget; a renew
          // failure is logged (not swallowed) so a dropped lease surfaces.
          renewUserAILock(userId, "reminder-ai").catch((err) =>
            logAIEvent("lock_renew_failed", { message: err.message }, "error"),
          );
          logAIEvent("step_finish", {
            inputTokens: usage?.promptTokens,
            outputTokens: usage?.completionTokens,
            toolCalls: toolResults?.length || 0,
          });
        },
        onFinish: ({ totalUsage, steps }) => {
          releaseOnce();
          logAIEvent("agent_complete", {
            totalSteps: steps.length,
            totalInputTokens: totalUsage?.promptTokens,
            totalOutputTokens: totalUsage?.completionTokens,
          });
        },
        onAbort: () => {
          releaseOnce();
          logAIEvent("agent_aborted", {});
        },
        onError: ({ error }) => {
          releaseOnce();
          logAIEvent("agent_error", { message: error.message }, "error");
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
    label: "POST /api/ai/agentic-reminder",
    errorMessage: "Failed to process request",
  },
);
