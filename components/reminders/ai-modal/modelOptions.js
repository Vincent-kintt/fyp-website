import { ALLOWED_AGENT_MODELS } from "@/lib/ai/allowedModels";

// Display metadata for each allowlisted model. The `value` set must always
// equal ALLOWED_AGENT_MODELS — tests/integration/ai-model-allowlist.test.js
// enforces no drift between UI options and route-schema enum.
const MODEL_LABELS = {
  "x-ai/grok-4.1-fast": { label: "Grok 4.1 Fast", desc: "Fast, great at tool use" },
  "deepseek/deepseek-v3.2": { label: "DeepSeek V3.2", desc: "Open-weight, good at Chinese" },
};

export const modelOptions = ALLOWED_AGENT_MODELS.map((value) => ({
  value,
  ...(MODEL_LABELS[value] || { label: value, desc: "" }),
}));
