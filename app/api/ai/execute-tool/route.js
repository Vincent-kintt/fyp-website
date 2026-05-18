import { z } from "zod";
import { apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { createTools } from "@/lib/ai/tools.js";
import { consumeAILimit } from "@/lib/rateLimit/aiRateLimiter.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only tools safe for direct invocation
const ALLOWED_TOOLS = new Set([
  "listReminders",
  "suggestReminders",
  "findConflicts",
  "analyzePatterns",
  "summarizeUpcoming",
  "exportReminders",
]);

const executeToolSchema = z.object({
  toolName: z
    .string({ error: "Tool name is required" })
    .min(1, "Tool name is required"),
  params: z.unknown().optional(),
});

export const POST = withAuth(
  async ({ request, userId }) => {
    const limit = await consumeAILimit(userId);
    if (!limit.ok) {
      return apiError(
        `Rate limit exceeded. Try again in ${limit.retryAfterSeconds} seconds.`,
        429,
        null,
        { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const { data, error } = await parseJsonBodyWithSchema(
      request,
      executeToolSchema,
    );
    if (error) return error;
    const { toolName, params } = data;

    if (!ALLOWED_TOOLS.has(toolName)) {
      return apiError(`Tool not allowed: ${toolName}`, 403);
    }

    const tools = createTools(userId);

    if (!tools[toolName]) {
      return apiError(`Unknown tool: ${toolName}`, 400);
    }

    // Validate input against tool's Zod schema (same validation the AI SDK does automatically)
    const parsed = tools[toolName].inputSchema.safeParse(params || {});
    if (!parsed.success) {
      return apiError("Invalid tool input", 400, {
        details: parsed.error.flatten(),
      });
    }

    // Tool result is the response body directly (its own { success, ... } shape)
    const result = await tools[toolName].execute(parsed.data);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  },
  { label: "POST /api/ai/execute-tool" },
);
