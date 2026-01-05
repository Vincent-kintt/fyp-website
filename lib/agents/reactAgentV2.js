/**
 * Streaming Agentic Agent V2
 * Uses native OpenAI-compatible function calling for reliable tool execution
 * Best Practice: API-native structured outputs instead of custom markup
 * Maintains streaming reasoning and content output like V1
 */

import { TOOLS, getOpenAITools } from "./tools/definitions.js";
import { executeTool } from "./tools/handlers.js";

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;

const MAX_ITERATIONS = 10;

export class ReActAgentV2 {
  constructor() {
    this.name = "AgenticAssistant";
  }

  getSystemPrompt(language, currentDate, currentTime, tomorrowDate, userLocation) {
    const langInstructions = language === "en"
      ? "Respond in English."
      : "用繁體中文回應。";

    let locationString = "Unknown";
    if (userLocation) {
      if (userLocation.city && userLocation.country) {
        locationString = `${userLocation.city}, ${userLocation.region || ""} ${userLocation.country}`.trim().replace(/\s+/g, " ");
      } else if (userLocation.timezone) {
        locationString = `Timezone: ${userLocation.timezone}`;
      }
    }

    return `You are an AI assistant that helps users manage reminders.
${langInstructions}

**Current Context:**
- Today: ${currentDate}
- Tomorrow: ${tomorrowDate}  
- Current Time: ${currentTime}
- User Location: ${locationString}

**IMPORTANT RULES:**
1. Use the provided tools to perform actions. Tools are called automatically when you specify them.
2. To update/delete a reminder, first call listReminders to get the ID, then call updateReminder/deleteReminder.
3. When adding subtasks, pass them as an array of strings: ["Task 1", "Task 2", "Task 3"]
4. Set priority based on urgency: "high" for urgent/important, "medium" for normal, "low" for casual.
5. Default time is 09:00, default category is "personal".

**Priority Guidelines:**
- HIGH: urgent, deadlines, meetings with boss, medical, financial
- MEDIUM: regular tasks, tomorrow's items, general errands  
- LOW: leisure, "no rush", long-term goals

Be conversational and helpful. After completing an action, summarize what you did.`;
  }

  /**
   * Main streaming execution with native function calling
   * Maintains streaming output for reasoning and content
   */
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
      userLocation = null,
    } = input;

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    yield {
      type: "agent_start",
      agent: this.name,
      message: language === "en" ? "Starting..." : "開始處理...",
    };

    const messages = [
      {
        role: "system",
        content: this.getSystemPrompt(language, currentDate, currentTime, tomorrowDate, userLocation) +
          (reasoningLanguage === "en" 
            ? "\n\n[Internal: Think in English.]"
            : "\n\n[Internal: 思考時使用繁體中文。]"),
      },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    let iteration = 0;
    let lastReminder = null;
    let totalContent = "";
    let totalReasoning = "";

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      
      yield {
        type: "iteration",
        iteration,
        title: language === "en" ? `Processing (step ${iteration})...` : `繼續處理 (步驟 ${iteration})...`,
      };

      // Stream LLM with tools - yields reasoning and content in real-time
      // Following best practices: progressive disclosure, real-time status, clear separation
      let fullReasoning = "";
      let fullContent = "";
      let toolCall = null;
      let hasYieldedReasoning = false;

      // Add separator for new iteration reasoning (like old agent)
      if (totalReasoning && iteration > 1) {
        totalReasoning += "\n\n---\n\n";
      }

      // Best Practice: Stream reasoning and content in REAL-TIME for better UX
      // Real-time streaming builds trust and reduces perceived latency
      for await (const chunk of this.streamLLMWithTools(messages, model, reasoningEffort, reasoningEnabled)) {
        if (chunk.type === "reasoning") {
          fullReasoning += chunk.content;
          hasYieldedReasoning = true;
          
          // Stream reasoning immediately for transparency
          const cumulativeReasoning = totalReasoning + fullReasoning;
          yield {
            type: "reasoning",
            agent: this.name,
            content: chunk.content,
            fullContent: cumulativeReasoning,
            iteration: iteration,
            iterationReasoning: fullReasoning,
          };
        }
        if (chunk.type === "content") {
          fullContent += chunk.content;
          
          // Stream content immediately
          const cumulativeContent = totalContent + (totalContent && fullContent ? "\n\n" : "") + fullContent;
          yield {
            type: "content",
            agent: this.name,
            content: chunk.content,
            fullContent: cumulativeContent,
            iteration: iteration,
            iterationContent: fullContent,
          };
        }
        if (chunk.type === "tool_call") {
          toolCall = chunk.toolCall;
        }
      }

      // Update totals after iteration
      totalReasoning += fullReasoning;
      if (fullContent) {
        if (totalContent) totalContent += "\n\n";
        totalContent += fullContent;
      }

      // If we have a tool call but no reasoning was yielded, yield synthetic reasoning
      // Best practice: always show status so user knows what's happening
      if (toolCall && !hasYieldedReasoning && !fullContent) {
        const syntheticReasoning = language === "en" 
          ? `Analyzing request and preparing to ${TOOLS[toolCall.name]?.actionText?.en || toolCall.name}...`
          : `分析請求，準備${TOOLS[toolCall.name]?.actionText?.zh || toolCall.name}...`;
        fullReasoning = syntheticReasoning;
        hasYieldedReasoning = true;
        yield {
          type: "reasoning",
          agent: this.name,
          content: syntheticReasoning,
          fullContent: totalReasoning + syntheticReasoning,
          iteration: iteration,
          iterationReasoning: syntheticReasoning,
        };
      }

      // Only yield reasoning_complete when there's a tool call but no content
      // This ensures we don't show duplicate reasoning blocks
      // If there's content, the reasoning is already properly streamed
      if (hasYieldedReasoning && fullReasoning && toolCall && !fullContent) {
        const cumulativeReasoning = totalReasoning + fullReasoning;
        yield {
          type: "reasoning_complete",
          agent: this.name,
          content: fullReasoning,
          fullContent: cumulativeReasoning,
          iteration: iteration,
          iterationReasoning: fullReasoning,
        };
      }

      // Check if there's a tool call
      if (toolCall) {
        const { name, arguments: args } = toolCall;
        
        // Best practice: clearly indicate tool invocation as distinct event
        yield {
          type: "tool_call",
          agent: this.name,
          tool: name,
          description: TOOLS[name]?.actionText?.[language] || name,
          params: args,
          iteration: iteration,
        };

        // Execute the tool
        try {
          const result = await executeTool(name, args, userId);
          
          // Best practice: show tool output clearly
          yield {
            type: "tool_result",
            agent: this.name,
            tool: name,
            result,
            success: result?.success !== false,
            iteration: iteration,
          };

          // Track created/updated reminders
          if (name === "createReminder" && result?.reminder) {
            lastReminder = result.reminder;
          }
          if (name === "updateReminder" && result?.reminder) {
            lastReminder = result.reminder;
          }

          // Add assistant message with tool call to history
          const toolCallId = `call_${Date.now()}_${iteration}`;
          messages.push({
            role: "assistant",
            content: fullContent || null,
            tool_calls: [{
              id: toolCallId,
              type: "function",
              function: { name, arguments: JSON.stringify(args) }
            }]
          });

          // Add tool result to history (must match the tool_call_id)
          messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: this.formatToolResult(name, result),
          });

          // Continue loop for next iteration
          continue;

        } catch (error) {
          yield {
            type: "tool_error",
            tool: name,
            error: error.message,
            iteration,
          };
          
          messages.push({
            role: "assistant", 
            content: fullContent || "",
          });
          messages.push({
            role: "user",
            content: `[Tool Error]: ${error.message}. Please try again or inform the user.`,
          });
          continue;
        }
      }

      // No tool call - task is complete
      // If we only have reasoning but no content, hide the reasoning
      // (reasoning without action/output is internal processing, not useful to user)
      if (fullReasoning && !fullContent) {
        yield {
          type: "reasoning_hide",
          iteration: iteration,
        };
      }
      break;
    }

    yield {
      type: "agent_complete",
      agent: this.name,
      result: {
        completed: true,
        iterations: iteration,
        reminder: lastReminder,
      },
    };
  }

  /**
   * Streaming LLM call with native function calling support
   * Yields reasoning and content chunks in real-time
   */
  async *streamLLMWithTools(messages, model, reasoningEffort, reasoningEnabled) {
    const isGeminiModel = model?.includes("gemini");
    const isGrokModel = model?.includes("grok");
    const isDeepSeekModel = model?.includes("deepseek");

    const requestBody = {
      model: model || process.env.LLM_MODEL || "x-ai/grok-4.1-fast",
      messages,
      tools: getOpenAITools(),
      tool_choice: "auto",
      temperature: 0.7,
      stream: true, // Enable streaming
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
        "X-Title": "AgenticAgent",
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
    
    // Accumulate tool calls by index (supports multiple parallel tool calls)
    // Each tool call has its own name and arguments
    const toolCalls = new Map(); // index -> { name, arguments }

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
            const choice = parsed.choices?.[0];

            // Stream reasoning (check multiple possible field names and locations)
            const reasoningContent = delta?.reasoning || delta?.reasoning_content || choice?.reasoning;
            if (reasoningContent) {
              yield { type: "reasoning", content: reasoningContent };
            }

            // Stream content
            if (delta?.content) {
              yield { type: "content", content: delta.content };
            }

            // Accumulate tool calls by index
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, { name: "", arguments: "" });
                }
                const call = toolCalls.get(idx);
                if (tc.function?.name) {
                  call.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  call.arguments += tc.function.arguments;
                }
              }
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer && buffer.startsWith("data: ")) {
      const data = buffer.slice(6);
      if (data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const choice2 = parsed.choices?.[0];
          const reasoningContent2 = delta?.reasoning || delta?.reasoning_content || choice2?.reasoning;
          if (reasoningContent2) yield { type: "reasoning", content: reasoningContent2 };
          if (delta?.content) yield { type: "content", content: delta.content };
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { name: "", arguments: "" });
              }
              const call = toolCalls.get(idx);
              if (tc.function?.name) call.name = tc.function.name;
              if (tc.function?.arguments) call.arguments += tc.function.arguments;
            }
          }
        } catch (e) {}
      }
    }

    // Yield only the FIRST tool call (we process one at a time in the loop)
    // This follows OpenAI best practice: handle one tool per iteration
    if (toolCalls.size > 0) {
      const firstCall = toolCalls.get(0);
      if (firstCall && firstCall.name) {
        let args = {};
        try {
          args = JSON.parse(firstCall.arguments);
        } catch (e) {
          console.error("[ReActAgentV2] Failed to parse tool arguments:", firstCall.arguments, e);
        }
        yield {
          type: "tool_call",
          toolCall: { name: firstCall.name, arguments: args },
        };
      }
    }
  }

  /**
   * Format tool result for the conversation
   * Best Practice: Return structured JSON for LLM to interpret
   * This is simpler, more consistent, and lets the LLM understand the full context
   */
  formatToolResult(toolName, result) {
    // For errors, return a clear error object
    if (!result?.success) {
      return JSON.stringify({ 
        success: false, 
        error: result?.error || "Unknown error" 
      });
    }

    // For listReminders, ensure IDs are string formatted for easy reference
    if (toolName === "listReminders" && result.reminders) {
      const formattedReminders = result.reminders.map(r => ({
        id: r._id?.toString() || r.id,
        title: r.title,
        dateTime: r.dateTime,
        category: r.category,
        status: r.status || "pending",
        priority: r.priority,
        subtasksCount: r.subtasks?.length || 0,
      }));
      return JSON.stringify({
        success: true,
        count: result.count,
        reminders: formattedReminders,
        hint: "Use the 'id' field to update or delete reminders."
      });
    }

    // For all other tools, return the raw result as JSON
    // The LLM can interpret structured data better than formatted strings
    return JSON.stringify(result);
  }
}
