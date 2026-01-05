import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { normalizeTags } from "@/lib/utils";
import * as chrono from "chrono-node";

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;
const PARSE_MODEL = "x-ai/grok-4.1-fast";

// Custom chrono parser (keep standard casual for now, let LLM handle normalization)
const standardChrono = chrono.casual;

/**
 * POST /api/ai/parse-task
 * Lightweight NLP endpoint for Quick Add - extracts structured data from natural language
 * Returns parsed task data without creating the task
 */

/**
 * Parse date/time using chrono-node (reliable NLP date parsing)
 */
function parseDateTimeWithChrono(text, refDate) {
  if (!text) return null;
  
  // Use standard casual parser
  const results = standardChrono.parse(text, refDate, { forwardDate: true });
  
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
    const session = await getServerSession();
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
- **Normalize** them into standard English time expressions (e.g., "tmr" -> "tomorrow", "下週二" -> "next Tuesday", "25號" -> "25th").
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
  "date_expression": "normalized date string or null"
}

**Examples:**
- "submit report tmr morning" -> {"title": "Submit report", "tags": ["work"], "priority": "high", "date_expression": "tomorrow morning"}
- "buy milk 2day" -> {"title": "Buy milk", "tags": ["shopping"], "priority": "medium", "date_expression": "today"}
- "check email" -> {"title": "Check email", "tags": ["work"], "priority": "medium", "date_expression": null}`;

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
        temperature: 0.1, // Lower temperature for more deterministic output
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

    // Parse the normalized date expression with Chrono
    let chronoResult = null;
    if (llmParsed.date_expression) {
      chronoResult = parseDateTimeWithChrono(llmParsed.date_expression, now);
    }
    
    // Fallback: If LLM missed the date but Chrono can find something in the original text
    if (!chronoResult) {
       // Only try fallback if LLM didn't return a date_expression (meaning it didn't think there was a date)
       // If LLM returned one but Chrono failed, it might be garbage, so we could try original text too, 
       // but typically normalized is better. Let's just try original as a safety net.
       const fallbackResult = parseDateTimeWithChrono(text, now);
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
