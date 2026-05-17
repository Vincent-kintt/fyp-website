// JSON response helpers shared across app/api/**/route.js.
//
// Centralizes the { success, data | error } envelope so route handlers do
// not hand-roll `new Response(JSON.stringify(...))`.

import { NextResponse } from "next/server";

// `options.headers` is forwarded to NextResponse.json. Auth-scoped routes no
// longer need to thread cache-control headers here — the withAuth /
// withCronAuth wrappers apply `ensureNoStore` at every exit path. This option
// remains for non-auth endpoints and for handlers that want to set other
// per-response headers; cache directives that already include `no-store` are
// preserved by the wrapper, anything else is overwritten.
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
  // `options.headers` mirrors `apiSuccess` — see the comment above for the
  // post-wrapper-migration contract.
  const body = { ...(extra || {}), success: false, error: message };
  return NextResponse.json(body, { status, headers: options.headers });
}
