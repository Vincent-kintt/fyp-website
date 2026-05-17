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

const NO_STORE = "private, no-store";

export function ensureNoStore(response) {
  if (!(response instanceof Response)) return response;
  const current = response.headers.get("Cache-Control");
  if (!current || !current.includes("no-store")) {
    response.headers.set("Cache-Control", NO_STORE);
  }
  return response;
}
