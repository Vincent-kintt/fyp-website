// Cron-auth wrapper for app/api/cron/*.
//
// Kept in its own module so cron routes do not pull in next-auth's
// session machinery. Mirrors withAuth's shape: handler receives the
// happy path only; wrapper handles the bearer-token check + try/catch
// + 500 fallback.

import { apiError } from "@/lib/api/response.js";

export function withCronAuth(handler, options = {}) {
  const { label, errorMessage = "Internal server error" } = options;
  return async function route(request, context = {}) {
    const authHeader = request.headers.get("authorization");
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      return await handler({
        request,
        context,
        params: context.params,
      });
    } catch (err) {
      console.error(`${label || "Cron route"} error:`, err);
      return apiError(errorMessage, 500);
    }
  };
}
