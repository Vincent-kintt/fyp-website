import { getServerSession } from "next-auth";
import { simpleOrchestrator } from "@/lib/agents/simpleOrchestrator.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const {
      text,
      messages = [],
      model = process.env.LLM_MODEL || "x-ai/grok-4.1-fast",
      reasoningEffort = "medium",
      reasoningEnabled = true,
      language = "zh",
      reasoningLanguage = "zh",
      forceAgentic = true, // Always use agentic agent in agentic mode
      userLocation = null, // User's location for context
    } = body;

    if (!text || text.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Text input is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event) => {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          // Execute the multi-agent pipeline
          for await (const event of simpleOrchestrator.execute({
            userMessage: text,
            conversationHistory: messages,
            model,
            reasoningEffort,
            reasoningEnabled,
            language,
            reasoningLanguage,
            userId: session.user.username, // Pass username for tool execution (matches reminders collection)
            useReact: forceAgentic, // Force agentic agent in agentic mode
            userLocation, // Pass user location for context
          })) {
            sendEvent(event);
          }

          sendEvent({ type: "done" });
        } catch (error) {
          console.error("Orchestrator error:", error);
          sendEvent({
            type: "error",
            error: error.message || "An error occurred during processing",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("POST /api/ai/agentic-reminder error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to process request",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
