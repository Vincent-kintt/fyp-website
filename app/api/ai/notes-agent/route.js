import { streamText } from "ai";
import { getModel, getNotesModelId } from "@/lib/ai/provider.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";
import { apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBody } from "@/lib/api/body.js";

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

export const POST = withAuth(
  async ({ request }) => {
    const { data, error } = await parseJsonBody(request);
    if (error) return error;
    const {
      command,
      input,
      noteTitle,
      noteContext,
      language = "zh",
      model,
    } = data;

    if (!command) {
      return apiError("Command is required", 400);
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
        userMessage = "Generate a structured digest of this note's content.";
        break;
      default:
        return apiError(`Unknown command: ${command}`, 400);
    }

    const result = streamText({
      // notes generation uses general agent fallback chain
      model: getModel(getNotesModelId(model)),
      system: getNotesSystemPrompt({ language, noteTitle, noteContext }),
      messages: [{ role: "user", content: userMessage }],
      maxRetries: 2,
      onFinish: ({ usage }) => {
        logAIEvent("notes_agent_complete", {
          command,
          inputTokens: usage?.promptTokens,
          outputTokens: usage?.completionTokens,
        });
      },
    });

    return result.toTextStreamResponse();
  },
  {
    label: "POST /api/ai/notes-agent",
    errorMessage: "Failed to process request",
  },
);
