import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel, extractJsonMiddleware } from "ai";
import { loggingMiddleware } from "./middleware.js";
import {
  DEFAULT_PARSE_MODEL_ID,
  DEFAULT_AGENT_MODEL_ID,
} from "./modelIds.js";

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

// ─── Model ID resolvers ───────────────────────────────────────────────
// Each resolver walks its env fallback chain so callers don't repeat the
// same `process.env.X || process.env.Y || "literal"` pattern.

export function getParseModelId() {
  return process.env.PARSE_TASK_MODEL || DEFAULT_PARSE_MODEL_ID;
}

export function getNotesModelId(explicitModel) {
  return (
    explicitModel ||
    process.env.NOTES_AGENT_MODEL ||
    process.env.LLM_MODEL ||
    DEFAULT_AGENT_MODEL_ID
  );
}

export function getAgentModelId(explicitModel) {
  return explicitModel || process.env.LLM_MODEL || DEFAULT_AGENT_MODEL_ID;
}
