import { streamText } from "ai";
import { getModel } from "@/lib/ai/provider.js";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getNotesSystemPrompt({ language, noteTitle, noteContext }) {
  const lang = language === "zh" ? "繁體中文" : "English";
  return `You are a helpful AI assistant embedded in a notes editor. Respond in ${lang}.

Current note: "${noteTitle || "Untitled"}"

Context from the note:
${noteContext || "(empty)"}

Instructions:
- For /ask: Answer the question clearly and concisely. Use the note context if relevant.
- For /summarize: Create a clear, structured summary of the provided content. Use headings and bullet points.
- For /digest: Generate a structured digest with: Key Points, Action Items, and Summary sections.

Format your response in Markdown. Be concise and useful.`;
}

export async function POST(request) {
  const session = await auth();

  if (!session?.user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const {
      command,
      input,
      noteTitle,
      noteContext,
      language = "zh",
      model,
    } = await request.json();

    if (!command) {
      return new Response(
        JSON.stringify({ success: false, error: "Command is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let userMessage;
    switch (command) {
      case "ask":
        userMessage = input || "Please help me.";
        break;
      case "summarize":
        userMessage = input
          ? `Summarize the following:\n\n${input}`
          : "Summarize the entire note content.";
        break;
      case "digest":
        userMessage =
          "Generate a structured digest of this note's content.";
        break;
      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown command: ${command}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    const result = streamText({
      model: getModel(model),
      system: getNotesSystemPrompt({ language, noteTitle, noteContext }),
      messages: [{ role: "user", content: userMessage }],
      maxRetries: 2,
      onFinish: ({ usage }) => {
        console.log(
          JSON.stringify({
            event: "notes_agent_complete",
            command,
            inputTokens: usage?.promptTokens,
            outputTokens: usage?.completionTokens,
            timestamp: new Date().toISOString(),
          }),
        );
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("POST /api/ai/notes-agent error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
