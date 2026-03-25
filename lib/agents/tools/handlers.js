/**
 * Tool Handlers - Execute tool actions
 * Each handler receives params and executes the corresponding action
 */

import { getCollection } from "@/lib/db.js";
import { ObjectId } from "mongodb";
import { 
  normalizeTags, 
  getMainCategory, 
  isValidStatus, 
  isValidStatusTransition,
  deriveCompletedFromStatus,
  validateDuration,
  calculateEndTime,
  hasTimeOverlap
} from "@/lib/utils.js";

/**
 * Create a new reminder
 */
export async function createReminder(params, userId) {
  const { title, description, remark, dateTime, duration, category, tags, recurring, recurringType, priority, subtasks } = params;
  
  const reminders = await getCollection("reminders");
  
  // Validate duration if provided
  if (duration !== undefined) {
    const durationValidation = validateDuration(duration);
    if (!durationValidation.isValid) {
      return { success: false, error: durationValidation.error };
    }
  }
  
  // Process subtasks - convert string array to proper subtask objects
  const processedSubtasks = Array.isArray(subtasks) 
    ? subtasks.map((st, idx) => ({
        id: `st-${Date.now()}-${idx}`,
        title: typeof st === "string" ? st : st.title,
        completed: typeof st === "string" ? false : (st.completed || false),
      }))
    : [];
  
  // Process tags - normalize and deduplicate
  const processedTags = normalizeTags(tags || []);
  const effectiveCategory = category || getMainCategory(processedTags) || "personal";
  
  const result = await reminders.insertOne({
    title,
    description: description || "",
    remark: remark || "",
    dateTime: new Date(dateTime),
    duration: duration || null, // Duration in minutes for time blocking
    category: effectiveCategory,
    tags: processedTags,
    recurring: recurring || false,
    recurringType: recurringType || null,
    priority: priority || "medium",
    subtasks: processedSubtasks,
    userId: userId,
    status: "pending", // New status lifecycle field
    completed: false, // Backward compatibility
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const reminder = await reminders.findOne({ _id: result.insertedId });
  return { success: true, reminder };
}

/**
 * List reminders with filters
 */
export async function listReminders(params, userId) {
  const { filter = "all", category, tag, tags: filterTags, status } = params;
  
  const now = new Date();
  const query = { userId: userId };

  // Apply time filter
  if (filter === "today") {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    query.dateTime = { $gte: now, $lte: endOfDay };
  } else if (filter === "week") {
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    query.dateTime = { $gte: now, $lte: endOfWeek };
  } else if (filter === "month") {
    const endOfMonth = new Date(now);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    query.dateTime = { $gte: now, $lte: endOfMonth };
  }

  // Apply category filter (backward compatible - checks both category and tags)
  if (category) {
    query.$or = [
      { category: category },
      { tags: category }
    ];
  }

  // Apply tag filter (single tag) - avoid conflict with category $or
  if (tag) {
    if (query.$or) {
      query.$and = [
        { $or: query.$or },
        { tags: tag },
      ];
      delete query.$or;
    } else {
      query.tags = tag;
    }
  }

  // Apply tags filter (multiple tags - must have ALL) - avoid conflict with single tag
  if (filterTags && Array.isArray(filterTags) && filterTags.length > 0) {
    const normalizedFilterTags = normalizeTags(filterTags);
    if (query.$and) {
      query.$and.push({ tags: { $all: normalizedFilterTags } });
    } else if (query.tags) {
      // Single tag already set, combine
      query.$and = [
        { tags: query.tags },
        { tags: { $all: normalizedFilterTags } },
      ];
      delete query.tags;
    } else {
      query.tags = { $all: normalizedFilterTags };
    }
  }

  // Apply status filter (supports new lifecycle statuses)
  if (status && status !== "all") {
    if (["pending", "in_progress", "completed", "snoozed"].includes(status)) {
      query.status = status;
    }
  }

  const reminders = await getCollection("reminders");
  const results = await reminders
    .find(query)
    .sort({ dateTime: 1 })
    .limit(50)
    .toArray();

  return { success: true, reminders: results, count: results.length };
}

/**
 * Update an existing reminder
 */
export async function updateReminder(params, userId) {
  const { reminderId, title, description, remark, dateTime, duration, status, category, tags, priority, subtasks } = params;

  const reminders = await getCollection("reminders");
  
  // Fetch current reminder to validate status transition
  const currentReminder = await reminders.findOne({ _id: new ObjectId(reminderId), userId: userId });
  if (!currentReminder) {
    return { success: false, error: "Reminder not found" };
  }

  const updateData = { updatedAt: new Date() };
  if (title) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (remark !== undefined) updateData.remark = remark;
  if (dateTime) updateData.dateTime = new Date(dateTime);
  
  // Handle duration update
  if (duration !== undefined) {
    const durationValidation = validateDuration(duration);
    if (!durationValidation.isValid) {
      return { success: false, error: durationValidation.error };
    }
    updateData.duration = duration;
  }
  
  // Handle status update with transition validation
  if (status !== undefined) {
    if (!isValidStatus(status)) {
      return { success: false, error: `Invalid status: ${status}. Valid values: pending, in_progress, completed, snoozed` };
    }
    const currentStatus = currentReminder.status || "pending";
    if (!isValidStatusTransition(currentStatus, status)) {
      return { success: false, error: `Invalid status transition from '${currentStatus}' to '${status}'` };
    }
    updateData.status = status;
    // Keep completed field in sync for backward compatibility
    updateData.completed = deriveCompletedFromStatus(status);
    
    // Track status change timestamps
    if (status === "in_progress" && currentStatus !== "in_progress") {
      updateData.startedAt = new Date();
    }
    if (status === "completed" && currentStatus !== "completed") {
      updateData.completedAt = new Date();
    }
  }
  
  if (category) updateData.category = category;
  if (tags !== undefined) {
    updateData.tags = normalizeTags(tags);
  }
  if (priority) updateData.priority = priority;
  if (subtasks !== undefined) {
    updateData.subtasks = Array.isArray(subtasks) 
      ? subtasks.map((st, idx) => ({
          id: st.id || `st-${Date.now()}-${idx}`,
          title: typeof st === "string" ? st : st.title,
          completed: typeof st === "string" ? false : (st.completed || false),
        }))
      : [];
  }

  const updated = await reminders.findOneAndUpdate(
    { _id: new ObjectId(reminderId), userId: userId },
    { $set: updateData },
    { returnDocument: "after" }
  );

  if (!updated) {
    return { success: false, error: "Reminder not found" };
  }

  return { success: true, reminder: updated };
}

/**
 * Delete a reminder
 */
export async function deleteReminder(params, userId) {
  const { reminderId } = params;

  const reminders = await getCollection("reminders");
  const result = await reminders.deleteOne({ _id: new ObjectId(reminderId), userId: userId });

  if (result.deletedCount === 0) {
    return { success: false, error: "Reminder not found or already deleted" };
  }

  return { success: true, message: "Reminder deleted successfully" };
}

/**
 * Snooze a reminder
 */
export async function snoozeReminder(params, userId) {
  const { reminderId, snoozeDuration, duration } = params;
  // Support both 'snoozeDuration' and legacy 'duration' parameter
  const snoozeMinutes = snoozeDuration || duration;

  const reminders = await getCollection("reminders");
  const reminder = await reminders.findOne({ _id: new ObjectId(reminderId), userId: userId });

  if (!reminder) {
    return { success: false, error: "Reminder not found" };
  }

  // Validate status transition: only pending and in_progress can be snoozed
  const currentStatus = reminder.status || "pending";
  if (!isValidStatusTransition(currentStatus, "snoozed")) {
    return { success: false, error: `Cannot snooze a reminder with status '${currentStatus}'. Only pending or in-progress reminders can be snoozed.` };
  }

  const newDateTime = new Date(reminder.dateTime);
  newDateTime.setMinutes(newDateTime.getMinutes() + snoozeMinutes);

  // Calculate snoozedUntil time
  const snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);

  const updated = await reminders.findOneAndUpdate(
    { _id: new ObjectId(reminderId), userId: userId },
    {
      $set: {
        dateTime: newDateTime,
        status: "snoozed",
        completed: false, // Backward compatibility: snoozed is not completed
        snoozedUntil: snoozedUntil,
        updatedAt: new Date()
      }
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    return { success: false, error: "Reminder not found or update failed" };
  }

  return { success: true, reminder: updated, snoozedMinutes: snoozeMinutes, snoozedUntil };
}

/**
 * Suggest reminders based on patterns
 */
export async function suggestReminders(params, userId) {
  const { lookbackDays = 30 } = params;

  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

  const reminders = await getCollection("reminders");
  const pastReminders = await reminders
    .find({ userId: userId, dateTime: { $gte: lookbackDate } })
    .sort({ dateTime: -1 })
    .toArray();

  // Analyze patterns
  const categoryCount = {};
  const timeSlots = {};
  const recurringPatterns = {};

  pastReminders.forEach(r => {
    categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
    
    const hour = new Date(r.dateTime).getHours();
    const slot = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    timeSlots[slot] = (timeSlots[slot] || 0) + 1;

    if (r.recurring) {
      recurringPatterns[r.recurringType] = (recurringPatterns[r.recurringType] || 0) + 1;
    }
  });

  return {
    success: true,
    patterns: { categoryCount, timeSlots, recurringPatterns },
    suggestions: [
      "Consider setting recurring reminders for frequent tasks",
      "You create most reminders in the " + Object.keys(timeSlots).reduce((a, b) => timeSlots[a] > timeSlots[b] ? a : b, "morning"),
    ],
  };
}

/**
 * Find time conflicts
 */
export async function findConflicts(params, userId) {
  const { dateTime, duration = 60 } = params;

  const checkTime = new Date(dateTime);
  const checkDuration = duration || 60;
  
  // Fetch all non-completed reminders in a broader window
  const dayStart = new Date(checkTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(checkTime);
  dayEnd.setHours(23, 59, 59, 999);

  const reminders = await getCollection("reminders");
  const dayReminders = await reminders
    .find({
      userId: userId,
      dateTime: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["completed"] },
      completed: { $ne: true },
    })
    .toArray();

  // Use duration-aware overlap detection
  const conflicts = dayReminders.filter(r => {
    const rDuration = r.duration || 30; // Default 30 min if not set
    return hasTimeOverlap(checkTime, checkDuration, new Date(r.dateTime), rDuration);
  });

  // Calculate suggested times based on actual time blocks
  const suggestedTimes = [];
  if (conflicts.length > 0) {
    // Find the end of the last conflict
    const latestConflict = conflicts.reduce((latest, c) => {
      const endTime = calculateEndTime(c.dateTime, c.duration || 30);
      return endTime > latest ? endTime : latest;
    }, new Date(0));
    
    suggestedTimes.push(new Date(latestConflict.getTime() + 15 * 60 * 1000).toISOString()); // 15 min after
    suggestedTimes.push(new Date(checkTime.getTime() - checkDuration * 60 * 1000 - 15 * 60 * 1000).toISOString()); // Before
  }

  return {
    success: true,
    hasConflicts: conflicts.length > 0,
    conflicts,
    suggestedTimes,
  };
}

/**
 * Batch create reminders
 */
export async function batchCreate(params, userId) {
  const { reminders: remindersList = [], pattern } = params;

  if (!Array.isArray(remindersList) || remindersList.length === 0) {
    return { success: false, error: "reminders array is required and must not be empty" };
  }

  if (remindersList.length > 50) {
    return { success: false, error: "Cannot create more than 50 reminders at once" };
  }

  const reminders = await getCollection("reminders");
  const docs = remindersList.map((r, docIdx) => {
    const processedSubtasks = Array.isArray(r.subtasks) 
      ? r.subtasks.map((st, idx) => ({
          id: `st-${Date.now()}-${docIdx}-${idx}`,
          title: typeof st === "string" ? st : st.title,
          completed: typeof st === "string" ? false : (st.completed || false),
        }))
      : [];
    
    const processedTags = normalizeTags(r.tags || []);
    const effectiveCategory = r.category || getMainCategory(processedTags) || "personal";
    
    return {
      ...r,
      dateTime: new Date(r.dateTime),
      duration: r.duration || null, // Support duration in batch create
      category: effectiveCategory,
      tags: processedTags,
      priority: r.priority || "medium",
      subtasks: processedSubtasks,
      userId: userId,
      status: "pending", // New status lifecycle field
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  const result = await reminders.insertMany(docs);

  return { success: true, count: result.insertedCount, pattern };
}

/**
 * Analyze user patterns
 */
export async function analyzePatterns(params, userId) {
  const { analysisType = "frequency", period = "month" } = params;

  let startDate = new Date();
  if (period === "week") {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === "month") {
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    startDate = new Date(0); // All time
  }

  const remindersCollection = await getCollection("reminders");
  const reminders = await remindersCollection
    .find({ userId: userId, createdAt: { $gte: startDate } })
    .toArray();

  const analysis = {};

  if (analysisType === "frequency") {
    analysis.totalReminders = reminders.length;
    analysis.averagePerWeek = (reminders.length / Math.ceil((Date.now() - startDate) / (7 * 24 * 60 * 60 * 1000))).toFixed(1);
  } else if (analysisType === "categories") {
    analysis.byCategory = reminders.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});
  } else if (analysisType === "completion") {
    const completed = reminders.filter(r => r.completed).length;
    analysis.completionRate = ((completed / reminders.length) * 100).toFixed(1) + "%";
  }

  return { success: true, analysis, period };
}

/**
 * Summarize upcoming reminders
 */
export async function summarizeUpcoming(params, userId) {
  const { period = "today", groupBy = "date" } = params;

  const now = new Date();
  let endDate = new Date(now);

  if (period === "today") {
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "tomorrow") {
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    endDate.setDate(endDate.getDate() + 7);
  } else if (period === "month") {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  const remindersCollection = await getCollection("reminders");
  const reminders = await remindersCollection
    .find({
      userId: userId,
      dateTime: { $gte: now, $lte: endDate },
      completed: false,
    })
    .sort({ dateTime: 1 })
    .toArray();

  const grouped = {};
  reminders.forEach(r => {
    const key = groupBy === "category" ? r.category : r.dateTime.toISOString().split("T")[0];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  return { success: true, summary: grouped, total: reminders.length, period };
}

/**
 * Export reminders
 */
export async function exportReminders(params, userId) {
  const { format = "json", filter = "all" } = params;

  const listResult = await listReminders({ filter }, userId);
  const reminders = listResult.reminders;

  if (format === "json") {
    return { success: true, data: reminders, format: "json" };
  } else if (format === "csv") {
    const csv = [
      "Title,Description,DateTime,Category,Completed",
      ...reminders.map(r => 
        `"${r.title}","${r.description}","${r.dateTime}","${r.category}","${r.completed}"`
      ),
    ].join("\n");
    return { success: true, data: csv, format: "csv" };
  }

  return { success: false, error: "Unsupported format" };
}

/**
 * Set quick reminder
 */
export async function setQuickReminder(params, userId) {
  const { title, minutesFromNow, tags } = params;

  const dateTime = new Date();
  dateTime.setMinutes(dateTime.getMinutes() + minutesFromNow);

  return createReminder({
    title,
    dateTime: dateTime.toISOString(),
    category: "personal",
    tags: tags || [],
    recurring: false,
  }, userId);
}

/**
 * Create from template
 */
export async function templateCreate(params, userId) {
  const { templateName, customizations = {} } = params;

  const templates = {
    "daily-review": {
      title: "Daily Review",
      description: "Review today's accomplishments and plan tomorrow",
      category: "personal",
      recurring: true,
      recurringType: "daily",
    },
    "weekly-meeting": {
      title: "Weekly Team Meeting",
      description: "Weekly sync with the team",
      category: "work",
      recurring: true,
      recurringType: "weekly",
    },
    "medication": {
      title: "Take Medication",
      description: "Daily medication reminder",
      category: "health",
      recurring: true,
      recurringType: "daily",
    },
    "exercise": {
      title: "Exercise Time",
      description: "Daily workout session",
      category: "health",
      recurring: true,
      recurringType: "daily",
    },
  };

  const template = templates[templateName];
  if (!template) {
    return { success: false, error: "Template not found" };
  }

  const reminderData = { ...template, ...customizations };
  
  // Set default time if not provided
  if (!reminderData.dateTime) {
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0);
    reminderData.dateTime = defaultTime.toISOString();
  }

  return createReminder(reminderData, userId);
}

/**
 * Ask for clarification
 * Mainly a signal for the UI/Agent loop to stop and wait for user
 */
export async function askClarification(params, userId) {
  const { question, context } = params;
  return { success: true, question, context };
}

/**
 * Search the web using Perplexity API (Sonar)
 */
export async function searchWeb(params, userId) {
  const { query } = params;
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    return { 
      success: false, 
      error: "Perplexity API key is missing. Please add PERPLEXITY_API_KEY to .env.local" 
    };
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a helpful search assistant. Provide accurate, up-to-date information based on web search results. Be concise."
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "No results found.";
    
    // Parse citations if available (Perplexity often provides them)
    const citations = data.citations || [];
    
    return { 
      success: true, 
      results: [
        { 
          title: "Perplexity Search Result", 
          snippet: content,
          citations: citations
        }
      ] 
    };
  } catch (error) {
    console.error("Error performing web search:", error);
    return { 
      success: false, 
      error: `Search failed: ${error.message}` 
    };
  }
}

// Tool handler registry
export const TOOL_HANDLERS = {
  createReminder,
  listReminders,
  updateReminder,
  deleteReminder,
  snoozeReminder,
  suggestReminders,
  findConflicts,
  batchCreate,
  analyzePatterns,
  summarizeUpcoming,
  exportReminders,
  setQuickReminder,
  templateCreate,
  askClarification,
  searchWeb,
};

/**
 * Execute a tool by name
 */
export async function executeTool(toolName, params, userId) {
  const handler = TOOL_HANDLERS[toolName];
  
  if (!handler) {
    return { success: false, error: `Tool ${toolName} not found` };
  }

  try {
    return await handler(params, userId);
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { success: false, error: error.message };
  }
}
