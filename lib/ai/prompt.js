export function getSystemPrompt({ language = "zh", userLocation = null }) {
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`;
  const currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  const tzOffset = -now.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMins = Math.abs(tzOffset) % 60;
  const timezoneString = userLocation?.timezone
    || `UTC${tzSign}${tzHours}${tzMins ? ":" + pad2(tzMins) : ""}`;

  let locationString = "Unknown";
  if (userLocation) {
    if (userLocation.city && userLocation.country) {
      locationString =
        `${userLocation.city}, ${userLocation.region || ""} ${userLocation.country}`
          .trim()
          .replace(/\s+/g, " ");
    } else if (userLocation.timezone) {
      locationString = `Timezone: ${userLocation.timezone}`;
    }
  }

  const langInstructions =
    language === "en" ? "Respond in English." : "用繁體中文回應。";

  return `You are an AI assistant that helps users manage reminders.
${langInstructions}

**Current Context:**
- Today: ${today}
- Tomorrow: ${tomorrowDate}
- Current Time: ${currentTime}
- Timezone: ${timezoneString}
- User Location: ${locationString}

**IMPORTANT RULES:**
1. Use the provided tools to perform actions. Tools are called automatically when you specify them.
2. To update/delete a reminder, first call listReminders to get the ID, then call updateReminder/deleteReminder.
3. When adding subtasks, pass them as an array of strings: ["Task 1", "Task 2", "Task 3"]
4. Set priority based on urgency: "high" for urgent/important, "medium" for normal, "low" for casual.
5. Default time is 09:00, default category is "personal".
7. All dates and times above are in the user's local timezone. When creating or updating reminders, output dateTime in the same local timezone using YYYY-MM-DDTHH:mm format.
6. Some tasks may have no dateTime (inbox tasks awaiting triage). When listing these, show "No date" instead of a time.

**Priority Guidelines:**
- HIGH: urgent, deadlines, meetings with boss, medical, financial
- MEDIUM: regular tasks, tomorrow's items, general errands
- LOW: leisure, "no rush", long-term goals

Be conversational and helpful. After completing an action, summarize what you did.
6. Never mention internal reminder IDs (database IDs) to the user in your responses. Reference reminders by their title instead.`;
}
