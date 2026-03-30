/**
 * Time Resolver Agent - Specializes in parsing and resolving time/date expressions
 */

import { BaseAgent } from "./baseAgent.js";

export class TimeResolverAgent extends BaseAgent {
  constructor() {
    super("TimeResolver", "Resolves time and date expressions to ISO format");
  }

  getSystemPrompt(language, currentDate, currentTime, tomorrowDate) {
    const langInstructions = language === "en"
      ? "Respond in English only."
      : "只用繁體中文回應。";

    return `You are a Time Resolution Agent.

${langInstructions}

**Current Context:**
- Today: ${currentDate}
- Tomorrow: ${tomorrowDate}
- Current Time: ${currentTime}

**Your Task:**
Parse the time/date and respond with the resolved datetime.

**Response Format (EXACTLY like this):**
"時間：YYYY-MM-DD HH:mm"

Examples:
- "時間：${tomorrowDate} 09:00"
- "時間：2025-01-15 14:30"

**Rules:**
- Default time: 09:00, default date: tomorrow
- Output ONLY the datetime line, nothing else
- NO JSON, NO explanations`;
  }

  async *executeStream(input, context) {
    const { planResult, userMessage, language, model, reasoningEffort, reasoningEnabled, reasoningLanguage } = input;

    yield {
      type: "agent_start",
      agent: this.name,
      description: language === "en" ? "Resolving date and time..." : "正在解析日期和時間...",
    };

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().split(" ")[0].substring(0, 5);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const timeContext = planResult?.extractedInfo?.rawTime || "";
    const dateContext = planResult?.extractedInfo?.rawDate || "";

    const prompt = `User request: "${userMessage}"

Extracted time info: ${timeContext || "not specified"}
Extracted date info: ${dateContext || "not specified"}

Please resolve to exact date and time.`;

    let fullContent = "";
    let fullReasoning = "";

    const streamGenerator = this.callLLMStream({
      systemPrompt: this.getSystemPrompt(language, currentDate, currentTime, tomorrowDate),
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

    // Parse datetime from the response (format: "時間：YYYY-MM-DD HH:mm")
    let result = { dateTime: null, isRecurring: false };
    
    const dateTimeMatch = fullContent.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    if (dateTimeMatch) {
      result.dateTime = `${dateTimeMatch[1]}T${dateTimeMatch[2]}`;
    } else {
      // Default to tomorrow 09:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      result.dateTime = `${tomorrow.toISOString().split('T')[0]}T09:00`;
    }

    // Check for recurring patterns
    if (fullContent.includes("每天") || fullContent.includes("daily")) {
      result.isRecurring = true;
      result.recurringType = "daily";
    } else if (fullContent.includes("每週") || fullContent.includes("weekly")) {
      result.isRecurring = true;
      result.recurringType = "weekly";
    }

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

export const timeResolverAgent = new TimeResolverAgent();
