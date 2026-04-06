import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel, extractJsonMiddleware } from "ai";
import { loggingMiddleware } from "./middleware.js";

// AI SDK appends /chat/completions automatically.
// Strip it from the env URL if present (old raw-fetch code used the full endpoint).
function getBaseURL() {
  const url = process.env.LLM_API_URL || "";
  return url.replace(/\/chat\/completions\/?$/, "");
}

const provider = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.LLM_API_KEY,
  baseURL: getBaseURL(),
  supportsStructuredOutputs: true,
});

export function getModel(modelId) {
  const base = provider(modelId || process.env.LLM_MODEL);
  return wrapLanguageModel({
    model: base,
    middleware: [extractJsonMiddleware(), loggingMiddleware],
  });
}
