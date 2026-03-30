/**
 * Tag Agent - Suggests relevant tags for reminders
 * AI-friendly design: outputs structured tag suggestions
 */

import { BaseAgent } from "./baseAgent.js";
import { normalizeTags } from "@/lib/utils.js";

export class TagAgent extends BaseAgent {
  constructor() {
    super("TagSuggester", "Suggests relevant tags for reminders");
  }

  getSystemPrompt(language) {
    const langInstructions = language === "en"
      ? "Respond in English only."
      : "只用繁體中文回應。";

    return `You are a Tag Suggestion Agent for a reminder/task management app.

${langInstructions}

**Your Task:** Analyze the reminder and suggest 1-5 relevant tags.

**Tag Guidelines:**
- Use lowercase, no spaces (use hyphens for multi-word tags)
- Include at least one category tag: work, personal, health, or general
- Add context-specific tags based on content (e.g., meeting, deadline, exercise, shopping)
- Add project/topic tags if detectable (e.g., project-a, client-xyz)
- Add urgency tag if applicable: urgent, important

**Response Format (EXACTLY like this):**
tags: tag1, tag2, tag3

**Examples:**
- "tags: work, meeting, urgent"
- "tags: personal, shopping, weekend"
- "tags: health, exercise, daily"
- "tags: work, project-alpha, deadline"

**Rules:**
- Output ONLY the tags line
- 1-5 tags maximum
- NO # prefix
- NO JSON, NO explanations
- Default to "personal" if unclear`;
  }

  async *executeStream(input, context) {
    const { planResult, userMessage, language, model, reasoningEffort, reasoningEnabled, reasoningLanguage } = input;

    yield {
      type: "agent_start",
      agent: this.name,
      description: language === "en" ? "Suggesting tags..." : "正在建議標籤...",
    };

    const title = planResult?.suggestedTitle || "";
    const description = planResult?.extractedInfo?.description || "";

    const prompt = `Reminder to tag:
Title: "${title}"
Description: "${description}"
Original request: "${userMessage}"

Please suggest relevant tags for this reminder.`;

    let fullContent = "";
    let fullReasoning = "";

    const streamGenerator = this.callLLMStream({
      systemPrompt: this.getSystemPrompt(language),
      userMessage: prompt,
      model,
      temperature: 0.3,
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

    // Parse tags from the response (format: "tags: tag1, tag2, tag3")
    let tags = ["personal"]; // default
    
    const tagsMatch = fullContent.match(/tags[：:]\s*(.+)/i);
    if (tagsMatch) {
      const rawTags = tagsMatch[1].split(",").map(t => t.trim());
      tags = normalizeTags(rawTags);
    }

    // Ensure at least one category tag exists
    const categoryTags = ["work", "personal", "health", "general"];
    const hasCategory = tags.some(t => categoryTags.includes(t));
    if (!hasCategory) {
      tags.unshift("personal");
    }

    // Limit to 5 tags
    tags = tags.slice(0, 5);

    const result = { 
      tags,
      category: tags.find(t => categoryTags.includes(t)) || "personal"
    };

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

export const tagAgent = new TagAgent();
