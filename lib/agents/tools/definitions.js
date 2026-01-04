/**
 * Tool Definitions for Agent System
 * Centralized tool schemas and metadata
 */

export const TOOLS = {
  // Core reminder management
  createReminder: {
    name: "createReminder",
    description: "Create a new reminder with title, datetime, and category",
    actionText: { zh: "建立提醒中", en: "Creating reminder" },
    parameters: {
      title: "string - the reminder title",
      description: "string - optional description",
      dateTime: "string - ISO format YYYY-MM-DDTHH:mm",
      category: "string - work|personal|health|other",
      recurring: "boolean",
      recurringType: "string - daily|weekly|monthly|yearly (optional)",
    },
  },

  listReminders: {
    name: "listReminders",
    description: "Query and list reminders based on filters",
    actionText: { zh: "查詢提醒中", en: "Querying reminders" },
    parameters: {
      filter: "string - today|week|month|all",
      category: "string - work|personal|health|other (optional)",
      status: "string - pending|completed|all (optional)",
    },
  },

  updateReminder: {
    name: "updateReminder",
    description: "Update an existing reminder's details",
    actionText: { zh: "更新提醒中", en: "Updating reminder" },
    parameters: {
      reminderId: "string - reminder ID to update",
      title: "string - new title (optional)",
      description: "string - new description (optional)",
      dateTime: "string - new datetime ISO format (optional)",
      category: "string - new category (optional)",
    },
  },

  deleteReminder: {
    name: "deleteReminder",
    description: "Delete a specific reminder",
    actionText: { zh: "刪除提醒中", en: "Deleting reminder" },
    parameters: {
      reminderId: "string - reminder ID to delete",
      title: "string - reminder title for confirmation",
    },
  },

  snoozeReminder: {
    name: "snoozeReminder",
    description: "Postpone a reminder by a specified duration",
    actionText: { zh: "延後提醒中", en: "Snoozing reminder" },
    parameters: {
      reminderId: "string - reminder ID to snooze",
      duration: "number - minutes to snooze",
    },
  },

  // Smart features
  suggestReminders: {
    name: "suggestReminders",
    description: "Suggest reminders based on patterns and history",
    actionText: { zh: "分析建議中", en: "Analyzing suggestions" },
    parameters: {
      lookbackDays: "number - days to analyze (default 30)",
    },
  },

  findConflicts: {
    name: "findConflicts",
    description: "Detect time conflicts in upcoming reminders",
    actionText: { zh: "檢查衝突中", en: "Checking conflicts" },
    parameters: {
      dateTime: "string - datetime to check for conflicts",
      duration: "number - estimated duration in minutes (optional)",
    },
  },

  batchCreate: {
    name: "batchCreate",
    description: "Create multiple reminders at once",
    actionText: { zh: "批量建立中", en: "Batch creating" },
    parameters: {
      reminders: "array - array of reminder objects",
      pattern: "string - recurring pattern description",
    },
  },

  // Analysis and insights
  analyzePatterns: {
    name: "analyzePatterns",
    description: "Analyze user's reminder patterns and habits",
    actionText: { zh: "分析習慣中", en: "Analyzing patterns" },
    parameters: {
      analysisType: "string - frequency|categories|timing|completion",
      period: "string - week|month|all",
    },
  },

  summarizeUpcoming: {
    name: "summarizeUpcoming",
    description: "Summarize upcoming reminders and tasks",
    actionText: { zh: "總結事項中", en: "Summarizing tasks" },
    parameters: {
      period: "string - today|tomorrow|week|month",
      groupBy: "string - category|date|priority (optional)",
    },
  },

  // Utility functions
  exportReminders: {
    name: "exportReminders",
    description: "Export reminders to various formats",
    actionText: { zh: "匯出資料中", en: "Exporting data" },
    parameters: {
      format: "string - ics|json|csv",
      filter: "string - today|week|month|all",
    },
  },

  setQuickReminder: {
    name: "setQuickReminder",
    description: "Quickly set a reminder with minimal info (relative time)",
    actionText: { zh: "快速設定中", en: "Quick setting" },
    parameters: {
      title: "string - brief title",
      minutesFromNow: "number - minutes from current time",
    },
  },

  templateCreate: {
    name: "templateCreate",
    description: "Create reminder from predefined template",
    actionText: { zh: "套用模板中", en: "Applying template" },
    parameters: {
      templateName: "string - daily-review|weekly-meeting|medication|exercise",
      customizations: "object - custom overrides (optional)",
    },
  },

  // Clarification
  askClarification: {
    name: "askClarification",
    description: "Ask user for more information when request is unclear",
    actionText: { zh: "等待確認", en: "Awaiting confirmation" },
    parameters: {
      question: "string - the question to ask",
      context: "string - what information is needed",
    },
  },

  // Future capabilities
  searchWeb: {
    name: "searchWeb",
    description: "Search the web for information",
    actionText: { zh: "搜尋中", en: "Searching" },
    parameters: {
      query: "string - search query",
    },
  },
};

// Tool categories for organization
export const TOOL_CATEGORIES = {
  core: ["createReminder", "listReminders", "updateReminder", "deleteReminder"],
  smart: ["suggestReminders", "findConflicts", "batchCreate", "snoozeReminder"],
  analysis: ["analyzePatterns", "summarizeUpcoming"],
  utility: ["exportReminders", "setQuickReminder", "templateCreate"],
  system: ["askClarification", "searchWeb"],
};

// Get tools by category
export function getToolsByCategory(category) {
  return TOOL_CATEGORIES[category]?.map(name => TOOLS[name]) || [];
}

// Get all tool names
export function getAllToolNames() {
  return Object.keys(TOOLS);
}
