import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { generateReminderFromText } from "@/lib/llm";

// POST /api/ai/generate-reminder - Generate reminder from natural language
export async function POST(request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text } = body;

    if (!text || text.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Text input is required" },
        { status: 400 }
      );
    }

    // Generate reminder data from natural language
    const reminderData = await generateReminderFromText(text);

    return NextResponse.json({
      success: true,
      data: reminderData,
    });
  } catch (error) {
    console.error("POST /api/ai/generate-reminder error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate reminder"
      },
      { status: 500 }
    );
  }
}
