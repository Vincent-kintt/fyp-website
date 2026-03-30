/**
 * Base Agent class for the multi-agent reminder system
 * All specialized agents extend this base class
 */

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;

export class BaseAgent {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * Call LLM API with streaming support
   * @param {Object} options - Request options
   * @returns {AsyncGenerator} Streaming response generator
   */
  async *callLLMStream(options) {
    const {
      systemPrompt,
      userMessage,
      model = process.env.LLM_MODEL || "x-ai/grok-4.1-fast",
      temperature = 0.7,
      reasoningEffort = "medium",
      reasoningEnabled = true,
      reasoningLanguage = "zh", // "zh" for Chinese, "en" for English
    } = options;
    
    // Add reasoning language instruction to system prompt
    const reasoningLangInstruction = reasoningLanguage === "en" 
      ? "\n\n[Internal: When reasoning/thinking, use English.]"
      : "\n\n[Internal: 思考時請使用繁體中文。]";
    
    const enhancedSystemPrompt = systemPrompt + reasoningLangInstruction;

    const isGeminiModel = model.includes("gemini");
    const isGrokModel = model.includes("grok");
    const isDeepSeekModel = model.includes("deepseek");

    const requestBody = {
      model,
      messages: [
        { role: "system", content: enhancedSystemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      stream: true,
    };

    if (isGeminiModel) {
      requestBody.reasoning = { effort: reasoningEffort };
    }

    if (isGrokModel || isDeepSeekModel) {
      requestBody.reasoning = { enabled: reasoningEnabled };
    }

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "ReminderApp",
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
            yield parsed;
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  /**
   * Call LLM API without streaming (for quick responses)
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response with content and reasoning
   */
  async callLLM(options) {
    const {
      systemPrompt,
      userMessage,
      model = process.env.LLM_MODEL || "x-ai/grok-4.1-fast",
      temperature = 0.7,
      reasoningEffort = "medium",
      reasoningEnabled = true,
    } = options;

    const isGeminiModel = model.includes("gemini");
    const isGrokModel = model.includes("grok");
    const isDeepSeekModel = model.includes("deepseek");

    const requestBody = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      stream: false,
    };

    if (isGeminiModel) {
      requestBody.reasoning = { effort: reasoningEffort };
    }

    if (isGrokModel || isDeepSeekModel) {
      requestBody.reasoning = { enabled: reasoningEnabled };
    }

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "ReminderApp",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const reasoning = data.choices?.[0]?.message?.reasoning || "";

    return { content, reasoning };
  }

  /**
   * Execute the agent's task - to be implemented by subclasses
   */
  async execute(input, context) {
    throw new Error("execute() must be implemented by subclass");
  }
}
