/**
 * Planner Agent - Analyzes user intent and creates execution plan
 * First step in the multi-agent pipeline
 */

import { BaseAgent } from "./baseAgent.js";

export class PlannerAgent extends BaseAgent {
  constructor() {
    super("Planner", "Analyzes user intent and creates execution plan");
  }

  getSystemPrompt(language, currentDate, currentTime) {
    const langInstructions = language === "en"
      ? "Respond in English only."
      : "只用繁體中文回應。";

    return `You are a smart AI assistant that helps users create reminders.

${langInstructions}

**Current Context:**
- Today: ${currentDate}
- Current Time: ${currentTime}

**Your Task:**
Understand what the user REALLY wants. Not every message is about creating a reminder!

**Intent Recognition:**
1. **Clear reminder request**: "提醒我明天開會" → Proceed with reminder creation
2. **Unclear/general chat**: "hi", "你好", "明天天氣" → Ask what reminder they want to set
3. **Information request**: "搜尋天氣", "查詢..." → Politely explain you can only help with reminders

**Response Examples:**
- Clear request: "好的，我來幫你設定「開會」的提醒。"
- Unclear: "你好！請問你想設定什麼提醒呢？例如：提醒我明天下午3點開會。"
- Not a reminder: "抱歉，我只能幫你設定提醒哦！請告訴我你想要什麼時候提醒你做什麼事？"

**Rules:**
- Be natural and conversational
- Don't force everything into a reminder
- Ask for clarification when intent is unclear
- NO JSON, NO code blocks`;
  }

  async *executeStream(input, context) {
    const { userMessage, language, model, reasoningEffort, reasoningEnabled, reasoningLanguage } = input;
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().split(" ")[0].substring(0, 5);

    yield {
      type: "agent_start",
      agent: this.name,
      description: language === "en" ? "Analyzing your request..." : "正在分析你的請求...",
    };

    let fullContent = "";
    let fullReasoning = "";

    const streamGenerator = this.callLLMStream({
      systemPrompt: this.getSystemPrompt(language, currentDate, currentTime),
      userMessage,
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

    // Determine if this is a clear reminder request or needs clarification
    const isNotReminderRequest = 
      fullContent.includes("抱歉") || 
      fullContent.includes("只能幫你設定提醒") ||
      fullContent.includes("I can only help");
    
    const needsClarification = 
      isNotReminderRequest ||
      fullContent.includes("請問你想設定") ||
      fullContent.includes("請告訴我") ||
      fullContent.includes("什麼提醒") ||
      fullContent.includes("？") || 
      fullContent.includes("?");
    
    const plan = {
      understanding: fullContent,
      needsClarification,
      isNotReminderRequest,
      suggestedTitle: userMessage.slice(0, 50),
    };

    yield {
      type: "agent_complete",
      agent: this.name,
      result: plan,
      reasoning: fullReasoning,
      content: fullContent,
    };

    return plan;
  }
}

export const plannerAgent = new PlannerAgent();
