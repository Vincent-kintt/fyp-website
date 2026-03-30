import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel } from "ai";
import { loggingMiddleware } from "./middleware.js";

const provider = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_API_URL,
});

export function getModel(modelId) {
  const base = provider(modelId || process.env.LLM_MODEL);
  return wrapLanguageModel({ model: base, middleware: loggingMiddleware });
}
