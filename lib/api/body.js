// JSON request-body helpers for app/api/**/route.js.
//
// Discriminated union return: { data, error } — caller pattern:
//   const { data: body, error } = await parseJsonBody(request);
//   if (error) return error;
//
// Keeps malformed-body responses as 400 with the canonical apiError envelope,
// instead of letting SyntaxError bubble to a generic 500 catch.

import { apiError } from "./response.js";

export async function parseJsonBody(request) {
  try {
    const data = await request.json();
    return { data, error: null };
  } catch {
    return { data: null, error: apiError("Invalid JSON body", 400) };
  }
}

// Schema-aware variant. Use when the route has a Zod schema for the body shape.
export async function parseJsonBodyWithSchema(request, schema) {
  const { data, error } = await parseJsonBody(request);
  if (error) return { data: null, error };
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      data: null,
      error: apiError("Invalid request body", 400, {
        details: result.error.flatten(),
      }),
    };
  }
  return { data: result.data, error: null };
}
