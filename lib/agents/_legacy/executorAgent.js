/**
 * Executor Agent - Combines all agent results and generates final reminder JSON
 */

import { BaseAgent } from "./baseAgent.js";

export class ExecutorAgent extends BaseAgent {
  constructor() {
    super("Executor", "Generates final reminder from all agent results");
  }

  getSystemPrompt(language) {
    const langInstructions = language === "en"
      ? "Respond in English only."
      : "只用繁體中文回應。";

    return `You are the Executor Agent that confirms the reminder creation.

${langInstructions}

**Your Task:**
Confirm the reminder in a friendly, natural way.

**Response Examples:**
- "好的！已建立提醒「買牛奶」，時間：明天上午 9 點。"
- "已設定工作提醒「開會」，時間：下週一下午 2 點。"

**Rules:**
- Be concise and friendly (1-2 sentences)
- Mention the title and time naturally
- NO JSON, NO code blocks, NO markdown
- Sound like a helpful assistant`;
  }

  async *executeStream(input, context) {
    const {
      planResult,
      timeResult,
      categoryResult,
      userMessage,
      language,
      model,
      reasoningLanguage,
      reasoningEffort,
      reasoningEnabled,
    } = input;

    yield {
      type: "agent_start",
      agent: this.name,
      description: language === "en" ? "Creating your reminder..." : "正在建立你的提醒...",
    };

    const prompt = `Create the final reminder based on these analysis results:

**Original Request:** "${userMessage}"

**Plan Analysis:**
${JSON.stringify(planResult, null, 2)}

**Time Resolution:**
${JSON.stringify(timeResult, null, 2)}

**Category Classification:**
${JSON.stringify(categoryResult, null, 2)}

Please create the final reminder with a friendly summary.`;

    let fullContent = "";
    let fullReasoning = "";

    const streamGenerator = this.callLLMStream({
      systemPrompt: this.getSystemPrompt(language),
      userMessage: prompt,
      model,
      temperature: 0.5,
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

    // Build the reminder from previous agent results
    const reminder = {
      title: planResult?.suggestedTitle || userMessage.slice(0, 50),
      description: "",
      dateTime: timeResult?.dateTime || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      category: categoryResult?.category || "personal",
      recurring: timeResult?.isRecurring || false,
      recurringType: timeResult?.recurringType || null,
    };

    const result = { reminder, summary: fullContent };

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

export const executorAgent = new ExecutorAgent();
