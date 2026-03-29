/**
 * Tool Definitions for Agent System
 * Centralized tool schemas and metadata
 */

export const TOOLS = {
  // Core reminder management
  createReminder: {
    name: "createReminder",
    description: "Create a new reminder with title, datetime, tags, priority, duration (time blocking), and optional subtasks",
    actionText: { zh: "建立提醒中", en: "Creating reminder" },
    parameters: {
      title: "string - the reminder title",
      description: "string - optional description",
      remark: "string - additional notes/info for the reminder (optional)",
      dateTime: "string - ISO format YYYY-MM-DDTHH:mm",
      duration: "number - estimated duration in minutes for time blocking (optional, e.g., 30, 60, 90)",
      tags: "array - custom tags like ['work', 'urgent', 'project-a'] (auto-normalized)",
      category: "string - work|personal|health|other (legacy, prefer tags)",
      priority: "string - low|medium|high (default: medium)",
      subtasks: "array - optional array of subtask titles (strings)",
      recurring: "boolean",
      recurringType: "string - daily|weekly|monthly|yearly (optional)",
    },
  },

  listReminders: {
    name: "listReminders",
    description: "Query and list reminders based on filters including tags and status lifecycle",
    actionText: { zh: "查詢提醒中", en: "Querying reminders" },
    parameters: {
      filter: "string - today|week|month|all",
      tag: "string - filter by single tag (optional)",
      tags: "array - filter by multiple tags, must have ALL (optional)",
      category: "string - work|personal|health|other (legacy, optional)",
      status: "string - pending|in_progress|completed|snoozed|all (optional)",
    },
  },

  updateReminder: {
    name: "updateReminder",
    description: "Update an existing reminder's details including tags, priority, status, duration and subtasks",
    actionText: { zh: "更新提醒中", en: "Updating reminder" },
    parameters: {
      reminderId: "string - reminder ID to update",
      title: "string - new title (optional)",
      description: "string - new description (optional)",
      remark: "string - new remark/additional notes (optional)",
      dateTime: "string - new datetime ISO format (optional)",
      duration: "number - estimated duration in minutes (optional)",
      status: "string - pending|in_progress|completed|snoozed (optional)",
      tags: "array - new tags array, replaces existing (optional)",
      category: "string - new category (legacy, optional)",
      priority: "string - low|medium|high (optional)",
      subtasks: "array - array of subtask objects with {title, completed} (optional)",
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
    description: "Postpone a reminder by a specified duration. Sets status to 'snoozed' and stores snoozedUntil time.",
    actionText: { zh: "延後提醒中", en: "Snoozing reminder" },
    parameters: {
      reminderId: "string - reminder ID to snooze",
      snoozeDuration: "number - minutes to snooze (how long to postpone)",
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
    description: "Create multiple reminders at once. Each reminder can have priority, duration, and subtasks.",
    actionText: { zh: "批量建立中", en: "Batch creating" },
    parameters: {
      reminders: "array - array of reminder objects with {title, dateTime, category, priority?, duration?, subtasks?}",
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

/**
 * Convert tools to OpenAI-compatible function calling format
 * This is the best practice for reliable tool calling
 */
export function getOpenAITools() {
  return [
    {
      type: "function",
      function: {
        name: "createReminder",
        description: "Create a new reminder with title, datetime, duration for time blocking, tags for categorization, priority, and optional subtasks. Use tags like 'work', 'personal', 'urgent', 'project-name' for flexible organization.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "The reminder title" },
            description: { type: "string", description: "Optional description" },
            dateTime: { type: "string", description: "ISO format YYYY-MM-DDTHH:mm" },
            duration: { type: "integer", description: "Estimated duration in minutes for time blocking (e.g., 30, 60, 90). Helps with scheduling and calendar visualization." },
            tags: { 
              type: "array", 
              items: { type: "string" }, 
              description: "Custom tags for categorization. Examples: ['work', 'meeting'], ['personal', 'urgent'], ['health', 'exercise']. Tags are auto-normalized (lowercase, no spaces)." 
            },
            remark: { type: "string", description: "Additional notes or information for the reminder" },
            priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level" },
            subtasks: { type: "array", items: { type: "string" }, description: "Array of subtask titles" },
            recurring: { type: "boolean", description: "Is recurring" },
            recurringType: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
          },
          required: ["title", "dateTime"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "listReminders",
        description: "Query and list reminders based on filters. Can filter by time period, tags, or status lifecycle.",
        parameters: {
          type: "object",
          properties: {
            filter: { type: "string", enum: ["today", "week", "month", "all"], description: "Time filter" },
            tag: { type: "string", description: "Filter by a single tag (e.g., 'work', 'urgent')" },
            tags: { 
              type: "array", 
              items: { type: "string" }, 
              description: "Filter by multiple tags - reminders must have ALL specified tags" 
            },
            status: { type: "string", enum: ["pending", "in_progress", "completed", "snoozed", "all"], description: "Filter by status lifecycle" },
          },
          required: ["filter"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "updateReminder",
        description: "Update an existing reminder. Use this to modify tags, add subtasks, change title, priority, status, duration, etc.",
        parameters: {
          type: "object",
          properties: {
            reminderId: { type: "string", description: "The reminder ID to update" },
            title: { type: "string", description: "New title" },
            description: { type: "string", description: "New description" },
            dateTime: { type: "string", description: "New datetime in ISO format" },
            duration: { type: "integer", description: "Estimated duration in minutes" },
            status: { type: "string", enum: ["pending", "in_progress", "completed", "snoozed"], description: "New status. Use 'in_progress' when starting a task, 'completed' when done." },
            tags: { 
              type: "array", 
              items: { type: "string" },
              description: "New tags array. This REPLACES existing tags." 
            },
            remark: { type: "string", description: "New remark/additional notes" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            subtasks: { 
              type: "array", 
              items: { type: "string" },
              description: "Array of subtask titles to set. This REPLACES existing subtasks." 
            },
          },
          required: ["reminderId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "deleteReminder",
        description: "Delete a specific reminder",
        parameters: {
          type: "object",
          properties: {
            reminderId: { type: "string", description: "The reminder ID to delete" },
            title: { type: "string", description: "Reminder title for confirmation" },
          },
          required: ["reminderId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "searchWeb",
        description: "Search the web for real-time information like weather, news, events, or any current data. Use this when you need up-to-date information that you don't have.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to look up" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "snoozeReminder",
        description: "Postpone a reminder by a specified duration. Sets status to 'snoozed' and stores snoozedUntil time.",
        parameters: {
          type: "object",
          properties: {
            reminderId: { type: "string", description: "The reminder ID to snooze" },
            snoozeDuration: { type: "integer", description: "Minutes to snooze (how long to postpone)" },
          },
          required: ["reminderId", "snoozeDuration"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "suggestReminders",
        description: "Suggest reminders based on user's patterns and history",
        parameters: {
          type: "object",
          properties: {
            lookbackDays: { type: "integer", description: "Days to analyze (default 30)" },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "findConflicts",
        description: "Detect time conflicts in upcoming reminders for a given datetime",
        parameters: {
          type: "object",
          properties: {
            dateTime: { type: "string", description: "Datetime to check for conflicts (ISO format)" },
            duration: { type: "integer", description: "Estimated duration in minutes (optional, default 60)" },
          },
          required: ["dateTime"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "batchCreate",
        description: "Create multiple reminders at once. Each reminder can have priority, duration, and subtasks.",
        parameters: {
          type: "object",
          properties: {
            reminders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  dateTime: { type: "string", description: "ISO format YYYY-MM-DDTHH:mm" },
                  tags: { type: "array", items: { type: "string" } },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  duration: { type: "integer", description: "Duration in minutes" },
                  subtasks: { type: "array", items: { type: "string" } },
                },
                required: ["title", "dateTime"],
              },
              description: "Array of reminder objects to create",
            },
            pattern: { type: "string", description: "Recurring pattern description (optional)" },
          },
          required: ["reminders"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "analyzePatterns",
        description: "Analyze user's reminder patterns and habits (frequency, categories, timing, completion rate)",
        parameters: {
          type: "object",
          properties: {
            analysisType: { type: "string", enum: ["frequency", "categories", "timing", "completion"], description: "Type of analysis" },
            period: { type: "string", enum: ["week", "month", "all"], description: "Time period to analyze" },
          },
          required: ["analysisType"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "summarizeUpcoming",
        description: "Summarize upcoming reminders and tasks grouped by date, category, or priority",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "tomorrow", "week", "month"], description: "Time period" },
            groupBy: { type: "string", enum: ["category", "date", "priority"], description: "Grouping method (optional)" },
          },
          required: ["period"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "exportReminders",
        description: "Export reminders to various formats (JSON, CSV, ICS)",
        parameters: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["ics", "json", "csv"], description: "Export format" },
            filter: { type: "string", enum: ["today", "week", "month", "all"], description: "Time filter" },
          },
          required: ["format"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "setQuickReminder",
        description: "Quickly set a reminder with minimal info using relative time (minutes from now)",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Brief title" },
            minutesFromNow: { type: "integer", description: "Minutes from current time" },
          },
          required: ["title", "minutesFromNow"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "templateCreate",
        description: "Create reminder from predefined template (daily-review, weekly-meeting, medication, exercise)",
        parameters: {
          type: "object",
          properties: {
            templateName: { type: "string", enum: ["daily-review", "weekly-meeting", "medication", "exercise"], description: "Template name" },
            customizations: { type: "object", description: "Custom overrides for the template (optional)" },
          },
          required: ["templateName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "askClarification",
        description: "Ask the user for more information when the request is unclear or ambiguous. This pauses the agent loop to wait for user input.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string", description: "The question to ask the user" },
            context: { type: "string", description: "What information is needed and why" },
          },
          required: ["question"],
        },
      },
    },
  ];
}
