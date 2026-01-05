import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { normalizeTags } from "@/lib/utils";
import * as chrono from "chrono-node";

const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;
const PARSE_MODEL = "x-ai/grok-4.1-fast";

// Custom chrono parser to handle common abbreviations
const customChrono = chrono.casual.clone();
customChrono.parsers.push({
  pattern: () => /\b(tmr|tmrw|tom|2moro|2morrow)\b/i,
  extract: (context, match) => {
    const refDate = context.refDate;
    const tomorrow = new Date(refDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      day: tomorrow.getDate(),
      month: tomorrow.getMonth() + 1,
      year: tomorrow.getFullYear(),
    };
  },
});
// Add "tdy" for today
customChrono.parsers.push({
  pattern: () => /\b(tdy|2day)\b/i,
  extract: (context) => {
    const refDate = context.refDate;
    return {
      day: refDate.getDate(),
      month: refDate.getMonth() + 1,
      year: refDate.getFullYear(),
    };
  },
});

/**
 * POST /api/ai/parse-task
 * Lightweight NLP endpoint for Quick Add - extracts structured data from natural language
 * Returns parsed task data without creating the task
 */
/**
 * Parse date/time using chrono-node (reliable NLP date parsing)
 */
function parseDateTimeWithChrono(text, refDate) {
  const results = customChrono.parse(text, refDate, { forwardDate: true });
  
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

/**
 * Remove date/time text from input to get cleaner title
 */
function removeDateTimeFromText(text, matchedText) {
  if (!matchedText) return text;
  // Remove the matched date/time text and clean up
  return text
    .replace(new RegExp(matchedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
    .replace(/\s+/g, " ")
    .trim();
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
    
    // Step 1: Parse date/time with chrono-node (RELIABLE)
    const chronoResult = parseDateTimeWithChrono(text, now);
    
    // Step 2: Use LLM only for title, tags, priority (NOT date)
    const textForLLM = chronoResult 
      ? removeDateTimeFromText(text, chronoResult.matchedText)
      : text;

    const systemPrompt = `You are a task parser. Extract title, tags, and priority from user input.
DO NOT extract dates - dates are handled separately.

**Extract:**
1. **title** (required): Clean task title, remove date/time words
2. **tags** (optional): Array of tags from #hashtags or inferred from context
3. **priority** (optional): "low", "medium", or "high"

**Priority Rules:**
- HIGH: "urgent", "ASAP", "important", "緊急", "重要"
- LOW: "when free", "no rush", "有空"
- MEDIUM: Default

**Tag Inference:**
- Extract explicit #tags
- Infer: meeting/work→work, doctor→health, shopping→personal, bill/pay→finance

**Return ONLY valid JSON:**
{
  "title": "Clean task title",
  "tags": ["tag1", "tag2"],
  "priority": "medium"
}

**Example:** "pay the bill" → {"title": "Pay the bill", "tags": ["finance"], "priority": "medium"}
**Example:** "meeting #work urgent" → {"title": "Meeting", "tags": ["work"], "priority": "high"}`;

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
          { role: "user", content: textForLLM },
        ],
        temperature: 0.3,
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
      llmParsed = { title: textForLLM || text.trim() };
    }

    // Merge chrono date result with LLM result
    const result = {
      title: llmParsed.title || textForLLM || text.trim(),
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
