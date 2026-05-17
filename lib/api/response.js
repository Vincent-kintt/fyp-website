// JSON response helpers shared across app/api/**/route.js.
//
// Centralizes the { success, data | error } envelope so route handlers do
// not hand-roll `new Response(JSON.stringify(...))`.

import { NextResponse } from "next/server";

// `options.headers` is forwarded to NextResponse.json — used by auth-scoped
// endpoints to opt out of edge/CDN caching (e.g. "Cache-Control: private,
// no-store"). Existing callers continue to work unchanged.
export function apiSuccess(data, status = 200, pagination = null, options = {}) {
  const body = { success: true, data };
  if (pagination) {
    body.pagination = pagination;
  }
  return NextResponse.json(body, { status, headers: options.headers });
}

export function apiError(message, status = 500, extra = null, options = {}) {
  // Spread `extra` first so caller-supplied keys can add fields like `details`
  // but cannot override the canonical `success`/`error` envelope.
  // `options.headers` mirrors `apiSuccess` — auth-scoped error responses must
  // be able to opt out of edge/CDN caching too (e.g. "private, no-store").
  const body = { ...(extra || {}), success: false, error: message };
  return NextResponse.json(body, { status, headers: options.headers });
}
