/**
 * Orchestrator - Coordinates the multi-agent pipeline
 * Manages the flow: Planner → TimeResolver → CategoryClassifier → Executor
 */

import { plannerAgent } from "./plannerAgent.js";
import { timeResolverAgent } from "./timeResolverAgent.js";
import { categoryAgent } from "./categoryAgent.js";
import { executorAgent } from "./executorAgent.js";

export class Orchestrator {
  constructor() {
    this.agents = {
      planner: plannerAgent,
      timeResolver: timeResolverAgent,
      category: categoryAgent,
      executor: executorAgent,
    };
  }

  /**
   * Execute the full multi-agent pipeline with streaming
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
    } = input;

    const context = {
      conversationHistory,
      results: {},
    };

    yield {
      type: "pipeline_start",
      totalSteps: 4,
      steps: [
        { id: "planner", name: language === "en" ? "Planning" : "規劃分析", status: "pending" },
        { id: "timeResolver", name: language === "en" ? "Time Resolution" : "時間解析", status: "pending" },
        { id: "category", name: language === "en" ? "Classification" : "分類判斷", status: "pending" },
        { id: "executor", name: language === "en" ? "Generation" : "生成結果", status: "pending" },
      ],
    };

    // Step 1: Planner Agent
    yield { type: "step_start", stepId: "planner", stepIndex: 0 };

    let planResult = null;
    for await (const event of this.agents.planner.executeStream({
      userMessage,
      language,
      model,
      reasoningEffort,
      reasoningEnabled,
      reasoningLanguage,
    }, context)) {
      yield event;
      if (event.type === "agent_complete") {
        planResult = event.result;
        context.results.plan = planResult;
      }
    }

    yield { type: "step_complete", stepId: "planner", stepIndex: 0, result: planResult };

    // Check if clarification is needed - stop pipeline early
    if (planResult?.needsClarification) {
      // Mark remaining steps as skipped
      yield { type: "step_skip", stepId: "timeResolver", stepIndex: 1 };
      yield { type: "step_skip", stepId: "category", stepIndex: 2 };
      yield { type: "step_skip", stepId: "executor", stepIndex: 3 };
      
      yield {
        type: "pipeline_complete",
        finalResult: null,
        needsClarification: true,
        clarificationMessage: planResult.understanding,
        allResults: context.results,
      };
      return;
    }

    // Step 2: Time Resolver Agent
    yield { type: "step_start", stepId: "timeResolver", stepIndex: 1 };

    let timeResult = null;
    for await (const event of this.agents.timeResolver.executeStream({
      planResult,
      userMessage,
      language,
      model,
      reasoningEffort,
      reasoningEnabled,
      reasoningLanguage,
    }, context)) {
      yield event;
      if (event.type === "agent_complete") {
        timeResult = event.result;
        context.results.time = timeResult;
      }
    }

    yield { type: "step_complete", stepId: "timeResolver", stepIndex: 1, result: timeResult };

    // Step 3: Category Agent
    yield { type: "step_start", stepId: "category", stepIndex: 2 };

    let categoryResult = null;
    for await (const event of this.agents.category.executeStream({
      planResult,
      userMessage,
      language,
      model,
      reasoningEffort,
      reasoningEnabled,
      reasoningLanguage,
    }, context)) {
      yield event;
      if (event.type === "agent_complete") {
        categoryResult = event.result;
        context.results.category = categoryResult;
      }
    }

    yield { type: "step_complete", stepId: "category", stepIndex: 2, result: categoryResult };

    // Step 4: Executor Agent
    yield { type: "step_start", stepId: "executor", stepIndex: 3 };

    let executorResult = null;
    for await (const event of this.agents.executor.executeStream({
      planResult,
      timeResult,
      categoryResult,
      userMessage,
      language,
      model,
      reasoningEffort,
      reasoningEnabled,
      reasoningLanguage,
    }, context)) {
      yield event;
      if (event.type === "agent_complete") {
        executorResult = event.result;
        context.results.executor = executorResult;
      }
    }

    yield { type: "step_complete", stepId: "executor", stepIndex: 3, result: executorResult };

    // Pipeline complete
    yield {
      type: "pipeline_complete",
      finalResult: executorResult,
      allResults: context.results,
    };
  }
}

export const orchestrator = new Orchestrator();
