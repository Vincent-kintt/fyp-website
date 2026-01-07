import { auth } from "@/auth";

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;
const DEFAULT_LLM_MODEL = process.env.LLM_MODEL || "x-ai/grok-4.1-fast";

export async function POST(request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text, messages = [], model = DEFAULT_LLM_MODEL, reasoningEffort = "medium", reasoningEnabled = true, language = "zh" } = body;

    if (!text || text.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Text input is required" }),
        { status: 400 }
      );
    }

    const languageInstruction = language === "en" 
      ? "IMPORTANT: You MUST respond in English." 
      : "重要：你必須用繁體中文回應。";

    // 獲取當前日期和明天的日期
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const systemPrompt = `You are a professional AI assistant that helps users create reminders. Always respond in a concise, production-ready format without verbose thinking processes or section headers.

${languageInstruction}

**CURRENT DATE CONTEXT:**
- Today is: ${today}
- Tomorrow is: ${tomorrowDate}
- Current time: ${now.toTimeString().split(' ')[0].substring(0, 5)}

**Communication style:**
- Be direct and concise
- Don't use headers like "Clarifying", "Formulating", "Constructing" etc.
- Get straight to the point
- If you need clarification, ask directly: "What time would you like the reminder?"
- When ready to create, just output the JSON

**Reminder structure:**
- title: Short, clear title (required)
- description: Additional details (optional)
- dateTime: ISO format YYYY-MM-DDTHH:mm (required) - MUST use actual dates based on current date context above
- category: "personal", "work", "health", or "other" (required)
- recurring: Boolean (required)
- recurringType: "daily", "weekly", "monthly", or "yearly" (optional, only if recurring is true)

**Default rules:**
- No time mentioned → use 09:00
- No date mentioned → use tomorrow (${tomorrowDate})
- Make reasonable assumptions
- ALWAYS calculate dates relative to today (${today})

**Example good response:**
"I'll create a reminder to pay the bill tomorrow at 9 AM. Here's the structured data:

\`\`\`json
{
  "title": "Pay Bill",
  "description": "Reminder to pay the bill",
  "dateTime": "${tomorrowDate}T09:00",
  "category": "personal",
  "recurring": false
}
\`\`\`"

**Example conversation:**
User: "change it to 5 PM"
You: "Updated to 5 PM:

\`\`\`json
{
  "title": "Pay Bill",
  "description": "Reminder to pay the bill",
  "dateTime": "${tomorrowDate}T17:00",
  "category": "personal",
  "recurring": false
}
\`\`\`"`;

    const isGeminiModel = model.includes("gemini");
    const isGrokModel = model.includes("grok");
    const isDeepSeekModel = model.includes("deepseek");
    
    // 建構對話訊息，包含系統提示和對話歷史
    const conversationMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages
    ];

    const requestBody = {
      model: model,
      messages: conversationMessages,
      temperature: 1,
      stream: true,
    };

    // Gemini 使用 effort 參數
    if (isGeminiModel) {
      requestBody.reasoning = {
        effort: reasoningEffort,
      };
    }
    
    // Grok 和 DeepSeek 使用 enabled 參數
    if (isGrokModel || isDeepSeekModel) {
      requestBody.reasoning = {
        enabled: reasoningEnabled,
      };
    }

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`,
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "ReminderApp",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("LLM API Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return new Response(
        JSON.stringify({ success: false, error: `LLM API 錯誤 (${response.status}): ${errorData.substring(0, 200)}` }),
        { status: 500 }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("POST /api/ai/generate-reminder-stream error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to generate reminder"
      }),
      { status: 500 }
    );
  }
}
