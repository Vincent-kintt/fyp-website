function formatInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t).value;
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    time: `${g("hour")}:${g("minute")}`,
  };
}

export function getSystemPrompt({ language = "zh", userLocation = null, tzOffset = null }) {
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const userTz = userLocation?.timezone;

  let today, tomorrowDate, currentTime, timezoneString;

  if (userTz) {
    // IANA timezone available — use Intl API for accurate conversion
    const todayFmt = formatInTimezone(now, userTz);
    const tomorrowFmt = formatInTimezone(new Date(now.getTime() + 86400000), userTz);
    today = todayFmt.date;
    tomorrowDate = tomorrowFmt.date;
    currentTime = todayFmt.time;
    timezoneString = userTz;
  } else if (typeof tzOffset === "number") {
    // Numeric offset — shift server time to represent user's local time
    const shifted = new Date(now.getTime() + (now.getTimezoneOffset() - tzOffset) * 60000);
    today = `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}-${pad2(shifted.getDate())}`;
    const tmr = new Date(shifted);
    tmr.setDate(tmr.getDate() + 1);
    tomorrowDate = `${tmr.getFullYear()}-${pad2(tmr.getMonth() + 1)}-${pad2(tmr.getDate())}`;
    currentTime = `${pad2(shifted.getHours())}:${pad2(shifted.getMinutes())}`;
    const sign = tzOffset <= 0 ? "+" : "-";
    const h = Math.floor(Math.abs(tzOffset) / 60);
    const m = Math.abs(tzOffset) % 60;
    timezoneString = `UTC${sign}${h}${m ? ":" + pad2(m) : ""}`;
  } else {
    // Fallback: server local time
    today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const tmr = new Date(now);
    tmr.setDate(tmr.getDate() + 1);
    tomorrowDate = `${tmr.getFullYear()}-${pad2(tmr.getMonth() + 1)}-${pad2(tmr.getDate())}`;
    currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const off = -now.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const h = Math.floor(Math.abs(off) / 60);
    const m = Math.abs(off) % 60;
    timezoneString = `UTC${sign}${h}${m ? ":" + pad2(m) : ""}`;
  }

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
