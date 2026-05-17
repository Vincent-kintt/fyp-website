// Cron-auth wrapper for app/api/cron/*.
//
// Kept in its own module so cron routes do not pull in next-auth's
// session machinery. Mirrors withAuth's shape: handler receives the
// happy path only; wrapper handles the bearer-token check + try/catch
// + 500 fallback.
//
// Auth-scoped: every exit path (401, handler-return, 500) gets
// `private, no-store` via `ensureNoStore`. Cron output is per-account
// work and must never be cached by edge proxies / CDNs. Handler-set
// Cache-Control headers are only honored when they already include
// `no-store`; anything else is overwritten to `private, no-store`.

import { ensureNoStore } from "@/lib/api/cache.js";
import { apiError } from "@/lib/api/response.js";

export function withCronAuth(handler, options = {}) {
  const { label, errorMessage = "Internal server error" } = options;
  return async function route(request, context = {}) {
    const authHeader = request.headers.get("authorization");
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return ensureNoStore(new Response("Unauthorized", { status: 401 }));
    }

    try {
      const response = await handler({
        request,
        context,
        params: context.params,
      });
      return ensureNoStore(response);
    } catch (err) {
      console.error(`${label || "Cron route"} error:`, err);
      return ensureNoStore(apiError(errorMessage, 500));
    }
  };
}
