// Canonical allowlist of model ids that may be requested via AI route
// `model` body fields. Single source of truth for:
//   - lib/ai/allowedModels.js (this file)
//   - components/reminders/ai-modal/modelOptions.js (UI dropdown)
//   - app/api/ai/agentic-reminder/route.js  (z.enum schema)
//   - app/api/ai/notes-agent/route.js       (z.enum schema)
//
// Why server-safe (no React / DOM imports): UI imports from here, server
// schemas also import from here. Defining the list in a UI-only file and
// reverse-importing from the server would invert the dependency direction
// and break Next.js's server/client boundary.
//
// Note: this list governs *client-supplied* model ids only. Server-side
// fallbacks (LLM_MODEL env, DEFAULT_AGENT_MODEL_ID) bypass zod by design —
// they are operator-controlled, not user-controlled.

export const ALLOWED_AGENT_MODELS = Object.freeze([
  "deepseek/deepseek-v3.2",
]);
