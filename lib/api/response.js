// JSON response helpers shared across app/api/**/route.js.
//
// Centralizes the { success, data | error } envelope so route handlers do
// not hand-roll `new Response(JSON.stringify(...))`.

import { NextResponse } from "next/server";

export function apiSuccess(data, status = 200, pagination = null) {
  const body = { success: true, data };
  if (pagination) {
    body.pagination = pagination;
  }
  return NextResponse.json(body, { status });
}

export function apiError(message, status = 500, extra = null) {
  // Spread `extra` first so caller-supplied keys can add fields like `details`
  // but cannot override the canonical `success`/`error` envelope.
  const body = { ...(extra || {}), success: false, error: message };
  return NextResponse.json(body, { status });
}
