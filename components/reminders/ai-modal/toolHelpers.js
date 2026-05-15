export const MUTATION_TOOLS = [
  "createReminder",
  "updateReminder",
  "deleteReminder",
  "batchCreate",
  "snoozeReminder",
  "setQuickReminder",
  "templateCreate",
];

// Extract tool name from a part (handles both typed tool-<name> and dynamic-tool)
export function getToolName(part) {
  if (part.type === "dynamic-tool") return part.toolName;
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return null;
}

// Check if a part is a tool invocation
export function isToolPart(part) {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

export function getToolDescription(toolName, state, output) {
  if (state === "input-streaming" || state === "input-available") {
    const labels = {
      createReminder: "Creating reminder",
      updateReminder: "Updating reminder",
      deleteReminder: "Deleting reminder",
      batchCreate: "Creating multiple reminders",
      listReminders: "Fetching reminders",
      findConflicts: "Checking for conflicts",
      analyzePatterns: "Analyzing patterns",
      summarizeUpcoming: "Summarizing upcoming tasks",
      suggestReminders: "Generating suggestions",
      snoozeReminder: "Snoozing reminder",
      setQuickReminder: "Setting quick reminder",
      templateCreate: "Creating from template",
      exportReminders: "Exporting reminders",
      askClarification: "Asking for clarification",
      searchWeb: "Searching the web",
    };
    return labels[toolName] || `Running ${toolName}`;
  }
  if (output?.success === false) return `${toolName} failed`;
  switch (toolName) {
    case "createReminder":
      return `Created ${output?.reminder?.title || "reminder"}`;
    case "updateReminder":
      return `Updated ${output?.reminder?.title || "reminder"}`;
    case "deleteReminder":
      return "Deleted reminder";
    case "batchCreate":
      return `Created ${output?.count || ""} reminders`;
    case "listReminders":
      return `Listed ${output?.count || ""} reminders`;
    case "findConflicts":
      return output?.hasConflicts
        ? `Found ${output.conflicts?.length} conflicts`
        : "No conflicts found";
    case "analyzePatterns":
      return "Analysis complete";
    case "summarizeUpcoming":
      return `${output?.total || ""} upcoming tasks`;
    case "suggestReminders":
      return "Suggestions ready";
    case "snoozeReminder":
      return `Snoozed ${output?.snoozedMinutes || ""} minutes`;
    case "setQuickReminder":
      return "Quick reminder set";
    case "templateCreate":
      return "Created from template";
    case "exportReminders":
      return `Exported (${output?.format || "json"})`;
    case "askClarification":
      return "Need more info";
    case "searchWeb":
      return "Search complete";
    default:
      return `${toolName} completed`;
  }
}
