import { tool } from "ai";
import { z } from "zod";

export function createAskClarificationTool() {
  return tool({
    description:
      "Ask the user for more information when the request is unclear or ambiguous. This pauses the agent loop to wait for user input.",
    inputSchema: z.object({
      question: z.string().describe("The question to ask the user"),
      context: z
        .string()
        .optional()
        .describe("What information is needed and why"),
    }),
    execute: async (params) => {
      const { question, context } = params;
      return { success: true, question, context };
    },
  });
}
