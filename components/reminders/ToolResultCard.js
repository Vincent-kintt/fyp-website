"use client";

import { ErrorCard, GenericSuccessCard } from "./tool-cards/shared";
import ListRemindersCard from "./tool-cards/ListRemindersCard";
import CreateReminderCard from "./tool-cards/CreateReminderCard";
import UpdateReminderCard from "./tool-cards/UpdateReminderCard";
import DeleteReminderCard from "./tool-cards/DeleteReminderCard";
import SnoozeReminderCard from "./tool-cards/SnoozeReminderCard";
import BatchCreateCard from "./tool-cards/BatchCreateCard";
import FindConflictsCard from "./tool-cards/FindConflictsCard";
import AnalyzePatternsCard from "./tool-cards/AnalyzePatternsCard";
import SummarizeUpcomingCard from "./tool-cards/SummarizeUpcomingCard";
import SuggestRemindersCard from "./tool-cards/SuggestRemindersCard";
import ExportRemindersCard from "./tool-cards/ExportRemindersCard";
import QuickReminderCard from "./tool-cards/QuickReminderCard";
import TemplateCreateCard from "./tool-cards/TemplateCreateCard";
import AskClarificationCard from "./tool-cards/AskClarificationCard";
import SearchWebCard from "./tool-cards/SearchWebCard";

const CARDS = {
  listReminders: ListRemindersCard,
  createReminder: CreateReminderCard,
  updateReminder: UpdateReminderCard,
  deleteReminder: DeleteReminderCard,
  snoozeReminder: SnoozeReminderCard,
  batchCreate: BatchCreateCard,
  findConflicts: FindConflictsCard,
  analyzePatterns: AnalyzePatternsCard,
  summarizeUpcoming: SummarizeUpcomingCard,
  suggestReminders: SuggestRemindersCard,
  exportReminders: ExportRemindersCard,
  setQuickReminder: QuickReminderCard,
  templateCreate: TemplateCreateCard,
  askClarification: AskClarificationCard,
  searchWeb: SearchWebCard,
};

export default function ToolResultCard({ tool, result, input, success, error, language = "zh" }) {
  if (!success || error) {
    return <ErrorCard error={error || result?.error} language={language} />;
  }
  if (!result) return null;

  const Component = CARDS[tool];
  if (Component) {
    return <Component result={result} input={input} language={language} />;
  }
  return <GenericSuccessCard tool={tool} language={language} />;
}
