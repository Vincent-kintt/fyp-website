/**
 * Category Agent - Classifies reminders into appropriate categories
 */

import { BaseAgent } from "./baseAgent.js";

export class CategoryAgent extends BaseAgent {
  constructor() {
    super("CategoryClassifier", "Classifies reminders into categories");
  }

  getSystemPrompt(language) {
    const langInstructions = language === "en"
      ? "Respond in English only."
      : "只用繁體中文回應。";

    return `You are a Category Classification Agent.

${langInstructions}

**Available Categories:** work, personal, health, other

**Response Format (EXACTLY like this):**
"分類：[category]"

Examples:
- "分類：personal"
- "分類：work"
- "分類：health"

**Rules:**
- Output ONLY the category line
- Default to "personal" if unclear
- NO JSON, NO explanations`;
  }

  async *executeStream(input, context) {
    const { planResult, userMessage, language, model, reasoningEffort, reasoningEnabled, reasoningLanguage } = input;

    yield {
      type: "agent_start",
      agent: this.name,
      description: language === "en" ? "Classifying reminder..." : "正在分類提醒...",
    };

    const title = planResult?.suggestedTitle || "";
    const description = planResult?.extractedInfo?.description || "";

    const prompt = `Reminder to classify:
Title: "${title}"
Description: "${description}"
Original request: "${userMessage}"

Please classify this reminder.`;

    let fullContent = "";
    let fullReasoning = "";

    const streamGenerator = this.callLLMStream({
      systemPrompt: this.getSystemPrompt(language),
      userMessage: prompt,
      model,
      temperature: 0.2,
      reasoningEffort,
      reasoningEnabled,
      reasoningLanguage: reasoningLanguage || language,
    });

    for await (const chunk of streamGenerator) {
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.reasoning) {
        fullReasoning += delta.reasoning;
        yield {
          type: "reasoning",
          agent: this.name,
          content: delta.reasoning,
          fullContent: fullReasoning,
        };
      }

      if (delta?.content) {
        fullContent += delta.content;
        yield {
          type: "content",
          agent: this.name,
          content: delta.content,
          fullContent,
        };
      }
    }

    // Parse category from the response (format: "分類：[category]")
    let category = "personal"; // default
    
    const categoryMatch = fullContent.match(/分類[：:]\s*(work|personal|health|other)/i);
    if (categoryMatch) {
      category = categoryMatch[1].toLowerCase();
    } else if (fullContent.includes("工作") || fullContent.includes("work")) {
      category = "work";
    } else if (fullContent.includes("健康") || fullContent.includes("health")) {
      category = "health";
    }

    const result = { category };

    yield {
      type: "agent_complete",
      agent: this.name,
      result,
      reasoning: fullReasoning,
      content: fullContent,
    };

    return result;
  }
}

export const categoryAgent = new CategoryAgent();
