// HTTP cache-control helpers for API routes.
//
// Auth-scoped responses must never be cached by edge proxies / CDNs because
// they contain per-user data. The wrapper-level `ensureNoStore` is the single
// source of truth — apply at every auth-protected wrapper's exit paths.
//
// The `has("Cache-Control")` guard lets a handler opt INTO public caching by
// setting an explicit `Cache-Control` header (e.g. `public, max-age=N`).

const NO_STORE = "private, no-store";

export function ensureNoStore(response) {
  if (response instanceof Response && !response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", NO_STORE);
  }
  return response;
}
