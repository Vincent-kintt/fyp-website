// NextAuth catch-all route. Re-exports NextAuth's GET/POST handlers, with
// two route-local concerns layered on top:
//
//   1. POST is rate-limited per IP (5 attempts / 60s) — the 429 short-circuit
//      never reaches NextAuth's handler.
//   2. Every exit path (GET happy path, POST happy path, POST 429) is funneled
//      through `ensureNoStore` so edge proxies / CDNs never cache per-user
//      session JSON / OAuth callbacks. Handlers that want public caching can
//      set an explicit `Cache-Control` header — the helper preserves it.

import { handlers } from "@/auth";
import { ensureNoStore } from "@/lib/api/cache.js";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(request) {
  return ensureNoStore(await handlers.GET(request));
}

export async function POST(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { success, resetMs } = checkRateLimit(`auth:${ip}`, {
    maxAttempts: 5,
    windowMs: 60_000,
  });

  if (!success) {
    return ensureNoStore(
      new Response(
        JSON.stringify({ error: "Too many login attempts. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(resetMs / 1000)),
          },
        },
      ),
    );
  }

  return ensureNoStore(await handlers.POST(request));
}
