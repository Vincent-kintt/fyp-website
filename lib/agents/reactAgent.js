/**
 * Streaming Agentic Agent
 * Implements streaming multi-step task execution with real-time tool calling
 * 
 * Pattern: Stream → Detect Tool → Execute → Continue Streaming → Loop until done
 */

import { TOOLS } from "./tools/index.js";
import { executeTool } from "./tools/handlers.js";

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;

const MAX_ITERATIONS = 10; // Safety limit

export class ReActAgent {
  constructor() {
    this.name = "AgenticAssistant";
  }

  getSystemPrompt(language, currentDate, currentTime, tomorrowDate) {
    const langInstructions = language === "en"
      ? "Respond in English."
      : "用繁體中文回應。";

    const toolDescriptions = Object.entries(TOOLS)
      .map(([name, t]) => `- ${name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`)
      .join("\n");

    return `You are an autonomous AI assistant that helps users manage reminders.
You can perform multiple actions in sequence to complete complex tasks.

${langInstructions}

**Current Context:**
- Today: ${currentDate}
- Tomorrow: ${tomorrowDate}
- Current Time: ${currentTime}

**Available Tools:**
${toolDescriptions}

**How to Use Tools:**
When you need to perform an action, include the tool call at the END of your message using this format:
<!--TOOL:toolName:{"param1":"value1","param2":"value2"}-->

**CRITICAL RULES:**
1. **ONE TOOL PER TURN**: You must only call ONE tool per message. Wait for the result before calling the next one.
2. **VERIFY COMPLETION**: After a tool is executed, checking the result. If the user's request is not fully met, you MUST continue with the next step.
3. **DELETE/UPDATE FLOW**: To delete or update reminders, you usually need to 'listReminders' first to get IDs. Then, in the NEXT turn, use 'deleteReminder' or 'updateReminder'.
4. **BATCH OPERATIONS**: If you need to delete multiple items, you must call 'deleteReminder' for each one sequentially (one per turn) OR use 'batchCreate' for creating. 
   - *Note: For deleting multiple items, list them first, then delete them one by one in separate turns.*

**Examples:**

1. List all reminders:
讓我先查看所有的提醒事項...
<!--TOOL:listReminders:{"filter":"all"}-->

2. Delete a reminder (after listing):
好的，我來刪除這個提醒...
<!--TOOL:deleteReminder:{"reminderId":"abc123","title":"Meeting"}-->

3. Create a reminder:
我幫你建立一個新的提醒！
<!--TOOL:createReminder:{"title":"繳帳單","dateTime":"${tomorrowDate}T09:00","category":"personal","recurring":false}-->

**Important:**
- Always be conversational and friendly.
- Put the tool call at the END of your message.
- Hidden from user: The tool markup is hidden.
- If you see a tool result, use it to decide your next action.
- Default time: 09:00, default category: personal`;
  }

  /**
   * Streaming agentic execution with real-time tool detection and execution
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
    } = input;

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().split(" ")[0].substring(0, 5);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    yield {
      type: "agent_start",
      agent: this.name,
      description: language === "en" ? "Processing..." : "處理中...",
      iteration: 1,
    };

    // Agentic loop - stream, detect tools, execute, continue
    const agentHistory = [];
    let iteration = 0;
    let taskComplete = false;
    
    // Track cumulative content and reasoning across all iterations
    let totalReasoning = "";
    let totalContent = "";

    while (iteration < MAX_ITERATIONS && !taskComplete) {
      iteration++;

      // Only emit thinking_phase for step 2+, step 1 is covered by agent_start
      if (iteration > 1) {
        yield {
          type: "thinking_phase",
          phase: "iteration",
          description: language === "en" 
            ? `Continuing (step ${iteration})...` 
            : `繼續處理 (步驟 ${iteration})...`,
          iteration: iteration,
        };
        // Add separator for new iteration reasoning
        if (totalReasoning) {
          totalReasoning += "\n\n---\n\n";
        }
      }

      // Build messages for this iteration
      const messages = this.buildMessages(
        language, currentDate, currentTime, tomorrowDate,
        conversationHistory, userMessage, agentHistory, reasoningLanguage
      );

      // Stream LLM response and detect tools in real-time
      let fullContent = "";
      let fullReasoning = "";
      let detectedTool = null;
      let detectedToolParamsStr = ""; // To track json parsing

      console.log(`[ReActAgent] Iteration ${iteration} starting LLM stream...`);
      
      for await (const chunk of this.streamLLM(messages, model, reasoningEffort, reasoningEnabled)) {
        if (chunk.type === "reasoning") {
          fullReasoning += chunk.content;
          // Update cumulative reasoning
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
          
          // Filter out complete AND partial tool markup for display
          // Remove complete tool calls: <!--TOOL:name:{...}-->
          // Remove partial tool calls: <!--TOOL... (incomplete, still streaming)
          let cleanedIterationContent = fullContent
            .replace(/<!--TOOL:\w+:\{[\s\S]*?\}-->/g, "") // Complete tool calls
            .replace(/<!--TOOL[^>]*$/g, ""); // Partial tool markup at end (still streaming)
          
          // Debug: Log if we're filtering out tool markup
          if (fullContent.includes("<!--TOOL") && !cleanedIterationContent.includes("<!--TOOL")) {
            console.log(`[ReActAgent] Filtered tool markup from content`);
          }
          
          // Cumulative content across iterations
          const cumulativeContent = totalContent + (totalContent && cleanedIterationContent ? "\n\n" : "") + cleanedIterationContent;
          
          // Yield content to UI in real-time (without any tool markup)
          if (cumulativeContent.trim()) {
            yield {
              type: "content",
              agent: this.name,
              content: chunk.content.replace(/<!--TOOL[^>]*$/g, "").replace(/<!--TOOL:\w+:\{[\s\S]*?\}-->/g, ""),
              fullContent: cumulativeContent,
              iterationContent: cleanedIterationContent,
              iteration: iteration,
            };
          }
          
          // Check for complete tool call in accumulated content
          const toolMatch = fullContent.match(/<!--TOOL:(\w+):(\{[\s\S]*?\})-->/);
          if (toolMatch) {
            try {
              detectedTool = {
                name: toolMatch[1],
                params: JSON.parse(toolMatch[2]),
              };
            } catch (e) {
              console.error("[ReActAgent] Failed to parse tool call:", e);
            }
          }
        }
      }
      
      // Update cumulative totals after this iteration
      totalReasoning += fullReasoning;
      const cleanIterationContent = fullContent.replace(/<!--TOOL:\w+:\{[\s\S]*?\}-->/g, "").trim();
      if (cleanIterationContent) {
        if (totalContent) {
          totalContent += "\n\n";
        }
        totalContent += cleanIterationContent;
      }

      // Clean content for display
      const cleanContent = fullContent.replace(/<!--TOOL:[^>]*-->/g, "").trim();

      // If tool detected, execute it
      if (detectedTool) {
        yield {
          type: "tool_call",
          tool: detectedTool.name,
          description: TOOLS[detectedTool.name]?.actionText?.[language] || detectedTool.name,
          params: detectedTool.params,
          iteration: iteration,
        };

        // Execute the tool
        let toolResult;
        try {
          toolResult = await executeTool(detectedTool.name, detectedTool.params, userId);
          
          yield {
            type: "tool_result",
            tool: detectedTool.name,
            success: toolResult.success,
            result: toolResult,
            iteration: iteration,
          };
        } catch (error) {
          toolResult = { success: false, error: error.message };
          
          yield {
            type: "tool_error",
            tool: detectedTool.name,
            error: error.message,
            iteration: iteration,
          };
        }

        // Add to history for next iteration
        agentHistory.push({
          role: "assistant",
          content: cleanContent,
          tool: detectedTool.name,
          toolResult,
        });

        // Check if this was the final step
        if (detectedTool.name === "askClarification") {
          // Wait for user input
          taskComplete = true;
        }
        // listReminders, deleteReminder - always continue to show results or do more
        // createReminder - check if there's more to do
        else if (detectedTool.name === "createReminder" && toolResult.success) {
          const hasMoreTasks = this.checkForPendingTasks(userMessage, agentHistory);
          if (!hasMoreTasks) {
            taskComplete = true;
          }
        }
        // For other tools (listReminders, deleteReminder, etc.) - continue loop
        // The next iteration will generate a response with the results
      } else {
        // No tool call - this is the final response to user
        taskComplete = true;
        agentHistory.push({
          role: "assistant",
          content: cleanContent,
        });
      }
    }

    // Get the last reminder created (for preview)
    const lastReminder = agentHistory
      .filter(h => h.tool === "createReminder" && h.toolResult?.success)
      .pop()?.toolResult?.reminder;

    yield {
      type: "agent_complete",
      agent: this.name,
      result: {
        completed: taskComplete,
        iterations: iteration,
        reminder: lastReminder,
      },
    };
  }

  /**
   * Build messages array for LLM call
   */
  buildMessages(language, currentDate, currentTime, tomorrowDate, conversationHistory, userMessage, agentHistory, reasoningLanguage) {
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

    // Add agent history from current session
    for (const entry of agentHistory) {
      messages.push({
        role: "assistant",
        content: entry.content,
      });
      
      if (entry.toolResult) {
        messages.push({
          role: "user",
          content: `[Tool Result for ${entry.tool}]: ${JSON.stringify(entry.toolResult)}`,
        });
      }
    }

    return messages;
  }

  /**
   * Streaming LLM call - yields chunks in real-time
   */
  async *streamLLM(messages, model, reasoningEffort, reasoningEnabled) {
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
              yield { type: "reasoning", content: delta.reasoning };
            }

            if (delta?.content) {
              yield { type: "content", content: delta.content };
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
    
    // Process any remaining buffer content
    if (buffer && buffer.startsWith("data: ")) {
      const data = buffer.slice(6);
      if (data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.reasoning) {
            yield { type: "reasoning", content: delta.reasoning };
          }
          if (delta?.content) {
            yield { type: "content", content: delta.content };
          }
        } catch (e) {
          // Skip malformed JSON
        }
      }
    }
  }

  /**
   * Check if there are pending tasks in the original request
   */
  checkForPendingTasks(originalRequest, agentHistory) {
    // Check if request mentioned multiple actions
    const multiActionPatterns = [
      /然後|接著|並且|同時|還要|也要|之後/,
      /and\s+(then\s+)?(create|add|set|delete|remove)/i,
      /first.*then/i,
      /先.*再/,
    ];

    const hasMultiAction = multiActionPatterns.some(p => p.test(originalRequest));
    if (!hasMultiAction) return false;

    // Check what's been done
    const toolsUsed = agentHistory.filter(h => h.tool).map(h => h.tool);
    
    // If request mentions delete and create, check both are done
    const mentionsDelete = /delete|remove|刪除|移除/i.test(originalRequest);
    const mentionsCreate = /create|add|set|新增|建立|設定/i.test(originalRequest);
    
    if (mentionsDelete && mentionsCreate) {
      const hasDeleted = toolsUsed.includes("deleteReminder") || toolsUsed.includes("listReminders");
      const hasCreated = toolsUsed.includes("createReminder");
      return !(hasDeleted && hasCreated);
    }

    return false;
  }
}

export const reactAgent = new ReActAgent();
