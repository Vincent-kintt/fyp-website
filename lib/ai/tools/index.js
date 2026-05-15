import { makeToolContext } from "./shared.js";
import { createCreateReminderTool } from "./createReminder.js";
import { createListRemindersTool } from "./listReminders.js";
import { createUpdateReminderTool } from "./updateReminder.js";
import { createDeleteReminderTool } from "./deleteReminder.js";
import { createSnoozeReminderTool } from "./snoozeReminder.js";
import { createSuggestRemindersTool } from "./suggestReminders.js";
import { createFindConflictsTool } from "./findConflicts.js";
import { createBatchCreateTool } from "./batchCreate.js";
import { createAnalyzePatternsTool } from "./analyzePatterns.js";
import { createSummarizeUpcomingTool } from "./summarizeUpcoming.js";
import { createExportRemindersTool } from "./exportReminders.js";
import { createSetQuickReminderTool } from "./setQuickReminder.js";
import { createTemplateCreateTool } from "./templateCreate.js";
import { createAskClarificationTool } from "./askClarification.js";
import { createSearchWebTool } from "./searchWeb.js";

export function createTools(userId, userTimezone = null) {
  const ctx = makeToolContext({ userId, userTimezone });
  return {
    createReminder: createCreateReminderTool(ctx),
    listReminders: createListRemindersTool(ctx),
    updateReminder: createUpdateReminderTool(ctx),
    deleteReminder: createDeleteReminderTool(ctx),
    snoozeReminder: createSnoozeReminderTool(ctx),
    suggestReminders: createSuggestRemindersTool(ctx),
    findConflicts: createFindConflictsTool(ctx),
    batchCreate: createBatchCreateTool(ctx),
    analyzePatterns: createAnalyzePatternsTool(ctx),
    summarizeUpcoming: createSummarizeUpcomingTool(ctx),
    exportReminders: createExportRemindersTool(ctx),
    setQuickReminder: createSetQuickReminderTool(ctx),
    templateCreate: createTemplateCreateTool(ctx),
    askClarification: createAskClarificationTool(),
    searchWeb: createSearchWebTool(),
  };
}
