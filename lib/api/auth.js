// Session-auth helpers for app/api/**/route.js.
//
// - requireAuth(): direct helper that returns { session, userId, error }.
//   Use when a route needs to do work before/after the auth check (e.g.
//   release a lock on the unauth path).
// - withAuth(handler, opts): wrapper that handles session check + the
//   route-level try/catch + 500 fallback. Handler receives the happy path
//   only: { request, context, params, session, userId }.
//
// The wrapper applies `ensureNoStore` to every exit path (401, handler-return,
// 500). Auth-scoped responses must never be cached by edge proxies / CDNs;
// handlers that want public caching can set an explicit `Cache-Control`
// header — the helper preserves it.
//
// Cron auth lives in lib/api/cronAuth.js (no next-auth dep).

import { auth } from "@/auth";
import { ensureNoStore } from "@/lib/api/cache.js";
import { apiError } from "@/lib/api/response.js";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      userId: null,
      error: apiError("Unauthorized", 401),
    };
  }
  return { session, userId: session.user.id, error: null };
}

export function withAuth(handler, options = {}) {
  const { label, errorMessage = "Internal server error" } = options;
  return async function route(request, context = {}) {
    try {
      const { session, userId, error } = await requireAuth();
      if (error) return ensureNoStore(error);
      const response = await handler({
        request,
        context,
        params: context.params,
        session,
        userId,
      });
      return ensureNoStore(response);
    } catch (err) {
      console.error(`${label || "API route"} error:`, err);
      return ensureNoStore(apiError(errorMessage, 500));
    }
  };
}
