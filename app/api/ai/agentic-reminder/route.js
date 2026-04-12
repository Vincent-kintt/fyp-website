import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { getModel } from "@/lib/ai/provider.js";
import { createTools } from "@/lib/ai/tools.js";
import { getSystemPrompt } from "@/lib/ai/prompt.js";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await auth();

  if (!session?.user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const {
      messages: uiMessages,
      model,
      reasoningEffort = "medium",
      language = "zh",
      userLocation = null,
    } = await request.json();

    const messages = await convertToModelMessages(uiMessages);

    const result = streamText({
      model: getModel(model),
      system: getSystemPrompt({ language, userLocation }),
      messages,
      tools: createTools(session.user.id, userLocation?.timezone),
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
        console.log(
          JSON.stringify({
            event: "step_finish",
            inputTokens: usage?.promptTokens,
            outputTokens: usage?.completionTokens,
            toolCalls: toolResults?.length || 0,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      onFinish: ({ totalUsage, steps }) => {
        console.log(
          JSON.stringify({
            event: "agent_complete",
            totalSteps: steps.length,
            totalInputTokens: totalUsage?.promptTokens,
            totalOutputTokens: totalUsage?.completionTokens,
            timestamp: new Date().toISOString(),
          }),
        );
      },
      onError: ({ error }) => {
        console.error(
          JSON.stringify({
            event: "agent_error",
            message: error.message,
            timestamp: new Date().toISOString(),
          }),
        );
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("POST /api/ai/agentic-reminder error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process request",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
