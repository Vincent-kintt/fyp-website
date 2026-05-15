import { tool } from "ai";
import { z } from "zod";

export function createSearchWebTool() {
  return tool({
    description:
      "Search the web for real-time information like weather, news, events, or any current data. Use this when you need up-to-date information that you don't have.",
    inputSchema: z.object({
      query: z.string().describe("The search query to look up"),
    }),
    execute: async (params) => {
      const { query } = params;
      const apiKey = process.env.PERPLEXITY_API_KEY;

      if (!apiKey) {
        return {
          success: false,
          error:
            "Perplexity API key is missing. Please add PERPLEXITY_API_KEY to .env.local",
        };
      }

      try {
        const response = await fetch(
          "https://api.perplexity.ai/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful search assistant. Provide accurate, up-to-date information based on web search results. Be concise.",
                },
                {
                  role: "user",
                  content: query,
                },
              ],
              temperature: 0.2,
              top_p: 0.9,
              stream: false,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(
            `Perplexity API error: ${response.status} - ${errorData}`,
          );
        }

        const data = await response.json();
        const content =
          data.choices?.[0]?.message?.content || "No results found.";
        const citations = data.citations || [];

        return {
          success: true,
          results: [
            {
              title: "Perplexity Search Result",
              snippet: content,
              citations,
            },
          ],
        };
      } catch (error) {
        console.error("Error performing web search:", error);
        return {
          success: false,
          error: `Search failed: ${error.message}`,
        };
      }
    },
  });
}
