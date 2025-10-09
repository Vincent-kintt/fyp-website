/**
 * LLM Service for natural language processing
 * Supports multiple LLM providers (OpenRouter, OpenAI, etc.)
 */

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "anthropic/claude-3.5-sonnet";

/**
 * Generate reminder from natural language input
 * @param {string} userInput - Natural language description of the reminder
 * @returns {Promise<Object>} Structured reminder data
 */
export async function generateReminderFromText(userInput) {
  if (!LLM_API_URL || !LLM_API_KEY) {
    throw new Error("LLM API configuration is missing");
  }

  const systemPrompt = `You are a helpful assistant that converts natural language into structured reminder data.

Extract the following information from the user's input:
- title: A short, clear title for the reminder (required)
- description: Additional details about the reminder (optional)
- dateTime: The date and time in ISO format (YYYY-MM-DDTHH:mm) (required)
- category: One of: "personal", "work", "health", "other" (required)
- recurring: Boolean - is this a recurring reminder? (required)
- recurringType: If recurring is true, one of: "daily", "weekly", "monthly", "yearly" (optional)

If no specific time is mentioned, use 09:00 as default.
If no date is mentioned, use tomorrow's date.
If the input is unclear or missing critical information, make reasonable assumptions.

Respond ONLY with a valid JSON object, no additional text. Example:
{
  "title": "Team Meeting",
  "description": "Weekly sync with the development team",
  "dateTime": "2024-10-15T10:00",
  "category": "work",
  "recurring": true,
  "recurringType": "weekly"
}`;

  try {
    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`,
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "ReminderApp",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userInput,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("LLM API Error:", errorData);
      throw new Error(`LLM API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in LLM response");
    }

    // Extract JSON from the response (handle cases where LLM adds text around JSON)
    let jsonString = content.trim();

    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      // Try to extract JSON object from text
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    // Parse the JSON response
    let reminderData;
    try {
      reminderData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON:", jsonString);
      throw new Error("Invalid JSON response from LLM");
    }

    // Validate required fields
    if (!reminderData.title || !reminderData.dateTime || !reminderData.category) {
      throw new Error("Missing required fields in LLM response");
    }

    return reminderData;
  } catch (error) {
    console.error("Error generating reminder from text:", error);
    throw error;
  }
}

/**
 * Test LLM connection
 * @returns {Promise<boolean>} True if connection is successful
 */
export async function testLLMConnection() {
  try {
    const result = await generateReminderFromText("Test reminder for tomorrow at 2pm");
    return !!result;
  } catch (error) {
    console.error("LLM connection test failed:", error);
    return false;
  }
}
