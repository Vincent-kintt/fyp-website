import { getServerSession } from "next-auth";
import { executeTool } from "@/lib/agents/tools/handlers.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { toolName, params } = await request.json();

    if (!toolName) {
      return new Response(
        JSON.stringify({ error: "Tool name is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Execute the tool
    const result = await executeTool(toolName, params || {}, session.user.id);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Tool execution error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
