import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTools } from "@/lib/ai/tools.js";

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

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { toolName, params } = await request.json();

    if (!toolName) {
      return new Response(JSON.stringify({ error: "Tool name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_TOOLS.has(toolName)) {
      return new Response(
        JSON.stringify({ error: `Tool not allowed: ${toolName}` }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const tools = createTools(session.user.id);

    if (!tools[toolName]) {
      return new Response(
        JSON.stringify({ error: `Unknown tool: ${toolName}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate input against tool's Zod schema (same validation the AI SDK does automatically)
    const parsed = tools[toolName].inputSchema.safeParse(params || {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tool input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await tools[toolName].execute(parsed.data);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Tool execution error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
