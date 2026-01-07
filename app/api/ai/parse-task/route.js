import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeTags } from "@/lib/utils";
import * as chrono from "chrono-node";

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;
const PARSE_MODEL = "x-ai/grok-4.1-fast";

// Custom chrono parser with smart AM/PM inference
// When time is ambiguous (no AM/PM), assume PM for hours 1-6 (people rarely schedule at 1-6 AM)
const customChrono = chrono.casual.clone();
customChrono.refiners.push({
  refine: (context, results) => {
    results.forEach((result) => {
      // Only apply if meridiem (AM/PM) is not certain
      if (!result.start.isCertain('meridiem')) {
        const hour = result.start.get('hour');
        // Hours 1-6 without AM/PM -> assume PM (13:00-18:00)
        // This is because people rarely schedule tasks at 1-6 AM
        if (hour >= 1 && hour <= 6) {
          result.start.assign('meridiem', 1); // 1 = PM
          result.start.assign('hour', hour + 12);
        }
      }
    });
    return results;
  }
});

/**
 * POST /api/ai/parse-task
 * Lightweight NLP endpoint for Quick Add - extracts structured data from natural language
 * Returns parsed task data without creating the task
 */

/**
 * Parse date/time using chrono-node (reliable NLP date parsing)
 */
function parseDateTimeWithChrono(text, refDate, forceToday = false) {
  if (!text) return null;
  
  // Use custom parser with smart AM/PM inference
  // Disable forwardDate if user explicitly says "today" to prevent pushing to tomorrow
  const results = customChrono.parse(text, refDate, { forwardDate: !forceToday });
  
  if (results.length === 0) return null;
  
  const parsed = results[0];
  const startDate = parsed.start.date();
  
  // Check if time was explicitly mentioned
  const hasTime = parsed.start.isCertain("hour");
  
  // If no time specified, default to 09:00
  if (!hasTime) {
    startDate.setHours(9, 0, 0, 0);
  }
  
  // Format as ISO string without seconds
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  const day = String(startDate.getDate()).padStart(2, "0");
  const hours = String(startDate.getHours()).padStart(2, "0");
  const minutes = String(startDate.getMinutes()).padStart(2, "0");
  
  return {
    dateTime: `${year}-${month}-${day}T${hours}:${minutes}`,
    matchedText: parsed.text,
    confidence: hasTime ? 0.95 : 0.85,
  };
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { text, language = "zh" } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: "Text is required" },
        { status: 400 }
      );
    }

    const now = new Date();
    
    // HYBRID APPROACH: LLM Normalization + Deterministic Parsing
    // 1. LLM extracts intent and normalizes date string (e.g. "tmr" -> "tomorrow")
    // 2. Chrono parses the normalized date string reliably
    
    const systemPrompt = `You are a smart task parser.
Extract structured data from the user's natural language input.

**Date Handling Strategy:**
- Identify any date/time references (fuzzy, typos, slang, or foreign language).
- **Normalize** them into standard English time expressions that chrono-node can parse.
- **CRITICAL**: When there's a time component, ALWAYS use "at X:XX am/pm" format.
  - "today 4:30" -> "today at 4:30 pm" (assume PM for 1-6 without AM/PM)
  - "tmr 9am" -> "tomorrow at 9:00 am"
  - "下週二 3點" -> "next Tuesday at 3:00 pm"
- If no date is present, return null for date_expression.

**Extraction Rules:**
1. **title** (required): The task description with date/time words REMOVED. Clean and capitalize.
2. **tags** (optional): Inferred category tags (e.g., "buy milk" -> ["personal", "shopping"]).
3. **priority** (optional): "high", "medium", or "low".
4. **date_expression** (optional): The normalized English date string suitable for a parser.

**Priority Logic:**
- HIGH: Urgent words ("ASAP", "emergency", "dead", "important")
- LOW: Relaxed words ("whenever", "maybe", "someday")
- MEDIUM: Default

**Return JSON ONLY:**
{
  "title": "Clean Title",
  "tags": ["tag1"],
  "priority": "medium",
  "date_expression": "normalized date string or null",
  "is_today": false
}

**is_today**: Set to true ONLY if the user explicitly says "today", "今天", "今日", "2day", etc. This prevents the system from pushing past times to tomorrow.

**Examples:**
- "submit report tmr morning" -> {"title": "Submit report", "tags": ["work"], "priority": "high", "date_expression": "tomorrow morning", "is_today": false}
- "buy milk 2day" -> {"title": "Buy milk", "tags": ["shopping"], "priority": "medium", "date_expression": "today", "is_today": true}
- "today i need to present in 4:30" -> {"title": "Present", "tags": ["work"], "priority": "medium", "date_expression": "today at 4:30 pm", "is_today": true}
- "check email" -> {"title": "Check email", "tags": ["work"], "priority": "medium", "date_expression": null, "is_today": false}`;

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "QuickAddParser",
      },
      body: JSON.stringify({
        model: PARSE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3, // Lower temperature for more deterministic output
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[parse-task] LLM API error:", errorText);
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in LLM response");
    }

    // Extract JSON from response
    let jsonString = content.trim();
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    let llmParsed;
    try {
      llmParsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("[parse-task] JSON parse error:", jsonString);
      llmParsed = { title: text.trim() };
    }

    // Detect if user explicitly said "today"
    const isToday = llmParsed.is_today === true || 
      /\b(today|今天|今日|2day|tdy)\b/i.test(text);
    
    // Parse the normalized date expression with Chrono
    let chronoResult = null;
    if (llmParsed.date_expression) {
      chronoResult = parseDateTimeWithChrono(llmParsed.date_expression, now, isToday);
    }
    
    // Fallback: If LLM missed the date but Chrono can find something in the original text
    if (!chronoResult) {
       const fallbackResult = parseDateTimeWithChrono(text, now, isToday);
       if (fallbackResult) {
         chronoResult = fallbackResult;
       }
    }

    // Construct final result
    const result = {
      title: llmParsed.title || text.trim(),
      tags: normalizeTags(llmParsed.tags || []),
      priority: llmParsed.priority || "medium",
      confidence: {
        title: 0.9,
        tags: llmParsed.tags?.length > 0 ? 0.8 : 0.5,
        priority: 0.7,
      },
    };

    // Add dateTime from chrono if parsed successfully
    if (chronoResult) {
      result.dateTime = chronoResult.dateTime;
      result.confidence.dateTime = chronoResult.confidence;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[parse-task] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
