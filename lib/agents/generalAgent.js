/**
 * General Purpose Agent
 * A flexible agent that can handle various tasks using tools
 */

import { TOOLS } from "./tools/index.js";
import { executeTool } from "./tools/handlers.js";

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;

// Thinking phases for UX
const THINKING_PHASES = {
  understanding: { zh: "理解你的需求...", en: "Understanding your request..." },
  analyzing: { zh: "分析最佳方案...", en: "Analyzing best approach..." },
  planning: { zh: "規劃執行步驟...", en: "Planning execution..." },
  executing: { zh: "執行中...", en: "Executing..." },
};

export class GeneralAgent {
  constructor() {
    this.name = "Assistant";
  }

  getSystemPrompt(language, currentDate, currentTime, tomorrowDate) {
    const langInstructions = language === "en"
      ? "Respond in English."
      : "用繁體中文回應。";

    const toolDescriptions = Object.values(TOOLS)
      .map(t => `- **${t.name}**: ${t.description}`)
      .join("\n");

    return `You are a helpful AI assistant that can perform various tasks.

${langInstructions}

**Current Context:**
- Today: ${currentDate} (${new Date().toLocaleDateString(language === "en" ? "en-US" : "zh-TW", { weekday: "long" })})
- Tomorrow: ${tomorrowDate}
- Current Time: ${currentTime}

**Available Tools:**
${toolDescriptions}

**Your Approach:**
1. Understand what the user wants
2. If it's a reminder request, extract ALL info (title, time, date, category) in ONE step
3. If unclear, ask for clarification naturally
4. If it's something you can't do, politely explain

**Response Format:**
If you need to use a tool, include ONLY the tool call (no extra text before it):
<!--TOOL:toolName:{"param":"value"}-->

The system will execute the tool and give you the result. Then you MUST generate a complete, meaningful response based on that result.

**Examples:**
User: "tell me all my reminders"
You: <!--TOOL:listReminders:{"filter":"all"}-->
[After receiving tool result with reminders list]
You: "你有 3 個提醒：
1. **開會** - 明天下午 2:00（工作）
2. **買菜** - 今天晚上 6:00（個人）
3. **運動** - 每天早上 7:00（健康）

需要我幫你修改或新增提醒嗎？"

User: "create a reminder for meeting tomorrow"
You: <!--TOOL:createReminder:{"title":"Meeting","dateTime":"${tomorrowDate}T09:00","category":"work","priority":"medium"}-->
[After tool confirms creation]
You: "好的！我已經幫你建立了一個提醒：**Meeting** 安排在明天上午 9:00。需要調整時間嗎？"

User: "add subtasks to my homework reminder"
You: <!--TOOL:listReminders:{"filter":"all"}-->
[After finding the reminder with ID]
You: <!--TOOL:updateReminder:{"reminderId":"found_id","subtasks":["Task 1","Task 2","Task 3"]}-->
[After tool confirms update]
You: "已經幫你新增了 3 個子任務！"

**Smart Priority Inference:**
When creating reminders, you MUST intelligently set the "priority" field based on task analysis:

**HIGH priority** - Set for:
- Urgent keywords: "urgent", "ASAP", "immediately", "critical", "important", "deadline", "緊急", "重要", "必須", "馬上"
- Time-sensitive: Due within 2 hours, or same-day deadlines
- High-stakes: interviews, presentations, exams, medical appointments, meetings with boss/client
- Financial: bills due, payments, taxes
- Health emergencies or medication

**MEDIUM priority** (default):
- Regular work tasks, routine meetings
- Tasks due tomorrow or within a few days
- General personal errands

**LOW priority** - Set for:
- Casual/leisure: movies, shopping, games
- "When you have time", "no rush", "有空再", "不急"
- Long-term goals without deadlines

**Rules:**
- When using a tool, output ONLY the tool call first
- After receiving tool results, generate a helpful summary/response
- Be conversational and synthesize the data into useful insights
- Don't just show raw data - explain, summarize, and offer next steps
- ALWAYS include "priority" in createReminder calls based on your analysis`;
  }

  async *executeStream(input) {
    const {
      userMessage,
      conversationHistory = [],
      language = "zh",
      model,
      reasoningEffort,
      reasoningEnabled,
      reasoningLanguage,
      userId,
    } = input;

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().split(" ")[0].substring(0, 5);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    // Emit thinking phases for better UX
    yield {
      type: "agent_start",
      agent: this.name,
      description: language === "en" ? "Thinking..." : "思考中...",
    };

    // Phase 1: Understanding
    yield {
      type: "thinking_phase",
      phase: "understanding",
      description: THINKING_PHASES.understanding[language] || THINKING_PHASES.understanding.zh,
    };

    // Build messages array
    const messages = [
      {
        role: "system",
        content: this.getSystemPrompt(language, currentDate, currentTime, tomorrowDate) +
          (reasoningLanguage === "en" 
            ? "\n\n[Internal: When reasoning/thinking, use English.]"
            : "\n\n[Internal: 思考時請使用繁體中文。]"),
      },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const isGeminiModel = model?.includes("gemini");
    const isGrokModel = model?.includes("grok");
    const isDeepSeekModel = model?.includes("deepseek");

    const requestBody = {
      model: model || process.env.LLM_MODEL || "x-ai/grok-4.1-fast",
      messages,
      temperature: 0.7,
      stream: true,
    };

    if (isGeminiModel) {
      requestBody.reasoning = { effort: reasoningEffort || "medium" };
    }
    if (isGrokModel || isDeepSeekModel) {
      requestBody.reasoning = { enabled: reasoningEnabled !== false };
    }

    try {
      const response = await fetch(LLM_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
          "X-Title": "AssistantApp",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorData}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let fullReasoning = "";
      let hasEmittedAnalyzing = false;
      let hasEmittedPlanning = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.reasoning) {
                fullReasoning += delta.reasoning;
                
                // Emit analyzing phase when reasoning starts
                if (!hasEmittedAnalyzing && fullReasoning.length > 20) {
                  hasEmittedAnalyzing = true;
                  yield {
                    type: "thinking_phase",
                    phase: "analyzing",
                    description: THINKING_PHASES.analyzing[language] || THINKING_PHASES.analyzing.zh,
                  };
                }
                
                yield {
                  type: "reasoning",
                  agent: this.name,
                  content: delta.reasoning,
                  fullContent: fullReasoning,
                };
              }

              if (delta?.content) {
                // Emit planning/executing phase when content starts
                if (!hasEmittedPlanning) {
                  hasEmittedPlanning = true;
                  yield {
                    type: "thinking_phase",
                    phase: "executing",
                    description: THINKING_PHASES.executing[language] || THINKING_PHASES.executing.zh,
                  };
                }
                
                fullContent += delta.content;
                yield {
                  type: "content",
                  agent: this.name,
                  content: delta.content,
                  fullContent,
                };
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      // Parse tool calls from the response
      const toolResult = this.parseToolCall(fullContent);
      
      // Execute the tool if detected
      let executionResult = null;
      let finalContent = fullContent.replace(/<!--TOOL:[^>]+-->/g, "").trim();
      
      if (toolResult?.tool && TOOLS[toolResult.tool]) {
        const tool = TOOLS[toolResult.tool];
        yield {
          type: "tool_call",
          tool: toolResult.tool,
          description: tool.actionText[language] || tool.actionText.zh,
          params: toolResult.params,
        };
        
        // Actually execute the tool
        try {
          executionResult = await executeTool(toolResult.tool, toolResult.params, userId);
          
          yield {
            type: "tool_result",
            tool: toolResult.tool,
            success: executionResult?.success,
            result: executionResult,
          };
          
          // ReAct Pattern: Continue generation with tool result
          // Build follow-up messages with tool result context
          const toolResultSummary = this.summarizeToolResult(toolResult.tool, executionResult, language);
          
          const followUpMessages = [
            ...messages,
            { role: "assistant", content: fullContent },
            { role: "user", content: `[Tool Result: ${toolResult.tool}]\n${toolResultSummary}\n\nNow generate a helpful, conversational response based on this data. Summarize the information meaningfully and offer next steps if appropriate.` },
          ];
          
          // Second LLM call to generate meaningful response
          yield {
            type: "thinking_phase",
            phase: "executing",
            description: language === "en" ? "Generating response..." : "生成回應中...",
          };
          
          let followUpContent = "";
          for await (const chunk of this.streamLLM(followUpMessages, model, reasoningEffort, reasoningEnabled, language)) {
            if (chunk.type === "content") {
              followUpContent = chunk.fullContent;
              yield {
                type: "content",
                agent: this.name,
                content: chunk.content,
                fullContent: followUpContent,
              };
            }
            // Don't re-emit reasoning for follow-up
          }
          
          finalContent = followUpContent || finalContent;
          
        } catch (error) {
          console.error("[GeneralAgent] Tool execution error:", error);
          yield {
            type: "tool_error",
            tool: toolResult.tool,
            error: error.message,
          };
        }
      } else if (finalContent) {
        // No tool call - just emit the content
        yield {
          type: "content",
          agent: this.name,
          content: "",
          fullContent: finalContent,
        };
      }

      yield {
        type: "agent_complete",
        agent: this.name,
        result: {
          ...toolResult,
          executionResult,
        },
        reasoning: fullReasoning,
        content: finalContent,
      };

      return { ...toolResult, executionResult };

    } catch (error) {
      yield {
        type: "error",
        agent: this.name,
        error: error.message,
      };
      throw error;
    }
  }

  parseToolCall(content) {
    const toolMatch = content.match(/<!--TOOL:(\w+):(\{[\s\S]*?\})-->/);
    if (toolMatch) {
      try {
        const toolName = toolMatch[1];
        const toolParams = JSON.parse(toolMatch[2]);
        return {
          tool: toolName,
          params: toolParams,
          // For backward compatibility with reminder creation
          reminder: toolName === "createReminder" ? toolParams : null,
        };
      } catch (e) {
        console.error("Failed to parse tool call:", e);
      }
    }
    return null;
  }

  async *streamLLM(messages, model, reasoningEffort, reasoningEnabled, language) {
    const isGeminiModel = model?.includes("gemini");
    const isGrokModel = model?.includes("grok");
    const isDeepSeekModel = model?.includes("deepseek");

    const requestBody = {
      model: model || process.env.LLM_MODEL || "x-ai/grok-4.1-fast",
      messages,
      temperature: 0.7,
      stream: true,
    };

    if (isGeminiModel) {
      requestBody.reasoning = { effort: reasoningEffort || "medium" };
    }
    if (isGrokModel || isDeepSeekModel) {
      requestBody.reasoning = { enabled: reasoningEnabled !== false };
    }

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "AssistantApp",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorData}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
              yield {
                type: "content",
                content: delta.content,
                fullContent,
              };
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  summarizeToolResult(toolName, result, language) {
    if (!result?.success) {
      return language === "en" 
        ? `Tool failed: ${result?.error || "Unknown error"}`
        : `工具執行失敗：${result?.error || "未知錯誤"}`;
    }

    switch (toolName) {
      case "listReminders":
        if (!result.reminders || result.reminders.length === 0) {
          return language === "en" ? "No reminders found." : "沒有找到任何提醒。";
        }
        const reminderList = result.reminders.map((r, i) => {
          const date = new Date(r.dateTime);
          const dateStr = date.toLocaleDateString(language === "en" ? "en-US" : "zh-TW", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
          });
          return `${i + 1}. "${r.title}" - ${dateStr} (${r.category})${r.completed ? " ✓" : ""}`;
        }).join("\n");
        return `Found ${result.count} reminder(s):\n${reminderList}`;

      case "createReminder":
        const r = result.reminder;
        return language === "en"
          ? `Successfully created reminder: "${r.title}" at ${new Date(r.dateTime).toLocaleString()}`
          : `成功建立提醒：「${r.title}」時間：${new Date(r.dateTime).toLocaleString("zh-TW")}`;

      case "deleteReminder":
        return language === "en" ? "Reminder deleted successfully." : "提醒已成功刪除。";

      case "updateReminder":
        return language === "en" ? "Reminder updated successfully." : "提醒已成功更新。";

      default:
        return JSON.stringify(result, null, 2);
    }
  }
}

export const generalAgent = new GeneralAgent();
