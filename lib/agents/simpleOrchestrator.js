/**
 * Simple Orchestrator - Supports both simple and ReAct agents
 * ReAct agent handles multi-step tasks autonomously
 */

import { generalAgent } from "./generalAgent.js";
import { reactAgent } from "./reactAgent.js";

export class SimpleOrchestrator {
  constructor() {
    this.simpleAgent = generalAgent;
    this.reactAgent = reactAgent;
  }

  /**
   * Detect if the task requires multi-step execution (ReAct)
   */
  isMultiStepTask(message) {
    const multiStepPatterns = [
      /delete\s*(all|every|所有|全部)/i,
      /remove\s*(all|every|所有|全部)/i,
      /清除.*所有/i,
      /刪除.*全部/i,
      /list.*then/i,
      /first.*then/i,
      /tell\s+me.*then/i,       // "tell me all my reminders then..."
      /show\s+me.*then/i,       // "show me... then..."
      /get.*then/i,             // "get all... then..."
      /\bthen\s+(help|make|create|add|set)/i,  // "...then help me add..."
      /先.*再/,
      /然後/,
      /接著/,
      /之後/,
      /and\s+(then\s+)?(create|add|set|make|help)/i,
      /並且/,
      /同時/,
      /還要/,
      /也要/,
      /幫我.*並/,
    ];
    
    return multiStepPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Execute the agent with streaming
   * @param {Object} input - User input and settings
   * @yields {Object} Stream events for UI updates
   */
  async *execute(input) {
    const {
      userMessage,
      conversationHistory = [],
      model,
      reasoningEffort,
      reasoningEnabled,
      language,
      reasoningLanguage,
      userId,
      useReact = null, // Allow explicit override
    } = input;

    // Determine which agent to use - ReAct for multi-step tasks
    const shouldUseReact = useReact !== null 
      ? useReact 
      : this.isMultiStepTask(userMessage);
    
    const agent = shouldUseReact ? this.reactAgent : this.simpleAgent;
    const agentName = shouldUseReact ? "Agentic" : "Simple";
    
    console.log(`[Orchestrator] Using ${agentName} agent for: "${userMessage.substring(0, 50)}..."`);

    // Define steps based on agent type
    const steps = shouldUseReact ? [
      { id: "planner", name: language === "en" ? "Planning" : "規劃分析", status: "pending" },
      { id: "executor", name: language === "en" ? "Execution" : "執行任務", status: "pending" },
      { id: "reviewer", name: language === "en" ? "Review" : "確認結果", status: "pending" }
    ] : [
      { 
        id: "assistant", 
        name: language === "en" 
          ? "Processing"
          : "處理中", 
        status: "pending" 
      },
    ];

    yield {
      type: "pipeline_start",
      totalSteps: steps.length,
      agentType: agentName,
      steps: steps,
    };

    // Start first step
    if (shouldUseReact) {
      yield { type: "step_start", stepId: "planner", stepIndex: 0 };
    } else {
      yield { type: "step_start", stepId: "assistant", stepIndex: 0 };
    }

    let result = null;
    let hasExecutedTool = false;
    let currentStepIndex = 0;

    try {
      for await (const event of agent.executeStream({
        userMessage,
        conversationHistory,
        language,
        model,
        reasoningEffort,
        reasoningEnabled,
        reasoningLanguage,
        userId,
      })) {
        
        // Dynamic step management for ReAct Agent
        if (shouldUseReact) {
          if (event.type === "tool_call" && !hasExecutedTool) {
            // Switch from Planner to Executor on first tool call
            hasExecutedTool = true;
            yield { type: "step_complete", stepId: "planner", stepIndex: 0 };
            yield { type: "step_start", stepId: "executor", stepIndex: 1 };
            currentStepIndex = 1;
          }
          
          // If we are in Executor step and receive agent_complete, move to Reviewer
          if (event.type === "agent_complete") {
             if (currentStepIndex === 0) {
               yield { type: "step_complete", stepId: "planner", stepIndex: 0 };
               yield { type: "step_skip", stepId: "executor", stepIndex: 1 };
             }
             if (currentStepIndex === 1) yield { type: "step_complete", stepId: "executor", stepIndex: 1 };
             
             yield { type: "step_start", stepId: "reviewer", stepIndex: 2 };
             result = event.result;
             
             // Short delay then complete the review step
             yield { type: "step_complete", stepId: "reviewer", stepIndex: 2 };
          }
        } else {
          if (event.type === "agent_complete") {
            result = event.result;
          }
        }

        yield event;
      }

      if (!shouldUseReact) {
        yield { type: "step_complete", stepId: "assistant", stepIndex: 0, result };
      }

      // Determine what action was taken
      const toolUsed = result?.tool;
      
      yield {
        type: "pipeline_complete",
        finalResult: result,
        toolUsed,
        agentType: agentName,
        iterations: result?.steps || 1,
        // For reminder compatibility
        reminder: result?.reminder,
        needsClarification: toolUsed === "askClarification",
      };

    } catch (error) {
      yield {
        type: "error",
        error: error.message,
      };
    }
  }
}

export const simpleOrchestrator = new SimpleOrchestrator();
