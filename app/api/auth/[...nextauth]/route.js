import { handlers } from "@/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export const { GET } = handlers;

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
    return new Response(
      JSON.stringify({ error: "Too many login attempts. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(resetMs / 1000)),
        },
      },
    );
  }

  return handlers.POST(request);
}
