import { logAIEvent } from "./logAIEvent.js";

export const loggingMiddleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    const start = Date.now();
    const result = await doGenerate();
    logAIEvent("llm_call", {
      model: params.modelId,
      inputTokens: result.usage?.promptTokens,
      outputTokens: result.usage?.completionTokens,
      toolCalls: result.toolCalls?.length || 0,
      finishReason: result.finishReason,
      durationMs: Date.now() - start,
    });
    return result;
  },
  wrapStream: async ({ doStream }) => doStream(),
};
