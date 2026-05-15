// Maps tool names emitted by the agentic and RSS streams to translation keys
// used to render progress labels inside the loading block. Consumed by
// useAgentCommand and useRssCommand via the toolProgressLabels ctx field.
export const TOOL_PROGRESS_LABELS = {
  searchNotes: "agentSearchingNotes",
  readNote: "agentReadingNote",
  listReminders: "agentCheckingReminders",
  findConflicts: "agentCheckingConflicts",
  summarizeUpcoming: "agentSummarizing",
  createReminder: "agentCreatingReminder",
  searchWeb: "agentSearchingWeb",
  getUserSubscriptions: "rssLoadingSubscriptions",
  fetchRSSFeeds: "rssFetchingFeeds",
};
