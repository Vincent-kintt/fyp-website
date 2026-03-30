import { auth } from "@/auth";
import { createTools } from "@/lib/ai/tools.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const tools = createTools(session.user.id);

    if (!tools[toolName]) {
      return new Response(
        JSON.stringify({ error: `Unknown tool: ${toolName}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await tools[toolName].execute(params || {});

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Tool execution error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
