import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { getModel, getAgentModelId } from "@/lib/ai/provider.js";
import { createTools } from "@/lib/ai/tools.js";
import { getSystemPrompt } from "@/lib/ai/prompt.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";
import { withAuth } from "@/lib/api/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(
  async ({ request, userId }) => {
    const {
      messages: uiMessages,
      model,
      reasoningEffort = "medium",
      language = "zh",
      userLocation = null,
    } = await request.json();

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
