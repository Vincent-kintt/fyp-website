// HTTP cache-control helpers for API routes.
//
// Auth-scoped responses must never be cached by edge proxies / CDNs because
// they contain per-user data. The wrapper-level `ensureNoStore` is the single
// source of truth — apply at every auth-protected wrapper's exit path.
//
// Contract:
//   `private, no-store` is mandatory for auth-scoped responses. The helper
//   only honors an explicit `Cache-Control` opt-in when the header ALREADY
//   includes `no-store` (e.g. `no-store`, `private, no-store, must-revalidate`).
//   Anything else — missing header, `no-cache` (AI SDK v6 streaming default),
//   `public, max-age=N`, etc — is overwritten to `private, no-store`.
//
// Why overwrite, not preserve:
//   AI SDK v6 `toUIMessageStreamResponse()` sets `Cache-Control: no-cache` by
//   default. `no-cache` allows revalidated caching by intermediaries, which is
//   unacceptable for per-user data. Preserving that value would leak the
//   no-store contract on every auth-scoped streaming route.
//
// Immutable-headers fallback:
//   Responses produced by `Response.redirect(...)` (and similar framework
//   factories) carry an immutable Headers guard per WHATWG fetch spec, so
//   `headers.set(...)` throws `TypeError`. NextAuth signin / signout /
//   callback flows return such redirects. The helper tries in-place mutation
//   first (fast path for the overwhelming majority of responses), and only
//   falls back to cloning the response with a fresh mutable Headers on the
//   throw. The clone reuses the body reference, which is safe here: redirect
//   responses have null/empty bodies, and streaming responses are constructed
//   in handler land with mutable headers and never take this path.

const NO_STORE = "private, no-store";

export function ensureNoStore(response) {
  if (!(response instanceof Response)) return response;
  const current = response.headers.get("Cache-Control");
  if (current && current.includes("no-store")) return response;

  try {
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", NO_STORE);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
