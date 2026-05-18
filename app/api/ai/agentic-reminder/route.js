import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { getModel, getAgentModelId } from "@/lib/ai/provider.js";
import { createTools } from "@/lib/ai/tools.js";
import { getSystemPrompt } from "@/lib/ai/prompt.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";
import { apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { ALLOWED_AGENT_MODELS } from "@/lib/ai/allowedModels.js";
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

    const { data, error } = await parseJsonBodyWithSchema(
      request,
      agenticReminderSchema,
    );
    if (error) return error;
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
      prepareStep: async ({ messages: stepMessages }) => {
        if (stepMessages.length > 30) {
          return {
            messages: [stepMessages[0], ...stepMessages.slice(-20)],
          };
        }
        return {};
      },
      providerOptions: {
        openrouter: { reasoningEffort },
      },
      onStepFinish: ({ usage, toolResults }) => {
        logAIEvent("step_finish", {
          inputTokens: usage?.promptTokens,
          outputTokens: usage?.completionTokens,
          toolCalls: toolResults?.length || 0,
        });
      },
      onFinish: ({ totalUsage, steps }) => {
        logAIEvent("agent_complete", {
          totalSteps: steps.length,
          totalInputTokens: totalUsage?.promptTokens,
          totalOutputTokens: totalUsage?.completionTokens,
        });
      },
      onError: ({ error }) => {
        logAIEvent("agent_error", { message: error.message }, "error");
      },
    });

    return result.toUIMessageStreamResponse();
  },
  {
    label: "POST /api/ai/agentic-reminder",
    errorMessage: "Failed to process request",
  },
);
