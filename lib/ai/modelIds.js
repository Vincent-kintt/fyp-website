// Client-safe model ID constants.
// This file MUST NOT import any server-only modules (AI SDK, MongoDB, env-bound code)
// so that "use client" components can import it without bundling server deps.

export const DEFAULT_PARSE_MODEL_ID = "deepseek/deepseek-v3.2";
export const DEFAULT_REMINDER_MODEL_ID = "deepseek/deepseek-v3.2";
export const DEFAULT_AGENT_MODEL_ID = "openai/gpt-4o-mini";
