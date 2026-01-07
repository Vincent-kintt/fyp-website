/**
 * Utility functions for the reminder application
 */

/**
 * Format a date to a readable string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format a date and time to a readable string
 * @param {Date|string} dateTime - DateTime to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(dateTime) {
  const d = new Date(dateTime);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Check if a reminder is overdue
 * @param {string} dateTime - Reminder datetime
 * @returns {boolean} True if overdue
 */
export function isOverdue(dateTime) {
  return new Date(dateTime) < new Date();
}

/**
 * Get category badge color
 * @param {string} category - Category name
 * @returns {string} Tailwind CSS classes for badge
 */
export function getCategoryColor(category) {
  const colors = {
    work: "bg-blue-100 text-blue-800",
    personal: "bg-green-100 text-green-800",
    health: "bg-red-100 text-red-800",
    other: "bg-gray-100 text-gray-800"
  };
  return colors[category] || colors.other;
}

/**
 * Validate reminder data
 * @param {Object} data - Reminder data
 * @returns {Object} Validation result with isValid and errors
 */
export function validateReminder(data) {
  const errors = {};

  if (!data.title || data.title.trim() === '') {
    errors.title = 'Title is required';
  }

  if (!data.dateTime) {
    errors.dateTime = 'Date and time are required';
  }

  if (!data.category) {
    errors.category = 'Category is required';
  }

  if (data.recurring && !data.recurringType) {
    errors.recurringType = 'Recurring type is required for recurring reminders';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================
// Tag System Utilities
// ============================================

/**
 * Predefined tag colors for consistent styling
 * AI-friendly: colors are deterministic based on tag name hash
 */
const TAG_COLORS = [
  { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30" },
  { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30" },
  { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30" },
  { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
];

/**
 * Normalize a tag to a consistent slug format
 * @param {string} tag - Raw tag input
 * @returns {string} Normalized tag slug
 */
export function normalizeTag(tag) {
  if (!tag || typeof tag !== "string") return "";
  
  return tag
    .toLowerCase()
    .trim()
    .replace(/^#/, "")           // Remove leading #
    .replace(/\s+/g, "-")        // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, "")  // Remove special chars
    .replace(/-+/g, "-")         // Collapse multiple hyphens
    .replace(/^-|-$/g, "")       // Trim hyphens from ends
    .slice(0, 30);               // Max 30 chars
}

/**
 * Normalize an array of tags, removing duplicates
 * @param {string[]} tags - Array of raw tags
 * @returns {string[]} Array of normalized unique tags
 */
export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  
  const normalized = tags
    .map(normalizeTag)
    .filter(tag => tag.length >= 2); // Min 2 chars
  
  return [...new Set(normalized)]; // Remove duplicates
}

/**
 * Validate a single tag
 * @param {string} tag - Tag to validate
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateTag(tag) {
  const normalized = normalizeTag(tag);
  
  if (normalized.length < 2) {
    return { isValid: false, error: "Tag must be at least 2 characters" };
  }
  if (normalized.length > 30) {
    return { isValid: false, error: "Tag must be 30 characters or less" };
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return { isValid: false, error: "Tag can only contain letters, numbers, and hyphens" };
  }
  
  return { isValid: true };
}

/**
 * Get deterministic color for a tag based on its name
 * @param {string} tag - Tag name (will be normalized)
 * @returns {object} Color object with bg, text, border classes
 */
export function getTagColor(tag) {
  const normalized = normalizeTag(tag);
  if (!normalized) return TAG_COLORS[0];
  
  // Simple hash function for deterministic color
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash = hash & hash;
  }
  
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

/**
 * Get Tailwind classes for tag styling
 * @param {string} tag - Tag name
 * @returns {string} Combined Tailwind classes
 */
export function getTagClasses(tag) {
  const color = getTagColor(tag);
  return `${color.bg} ${color.text} ${color.border}`;
}

/**
 * Convert legacy category to tag
 * @param {string} category - Legacy category (work, personal, health, other)
 * @returns {string} Tag equivalent
 */
export function categoryToTag(category) {
  const mapping = {
    work: "work",
    personal: "personal",
    health: "health",
    other: "general"
  };
  return mapping[category] || "general";
}

/**
 * Extract primary category from tags (for backward compatibility)
 * @param {string[]} tags - Array of tags
 * @returns {string} Primary category
 */
export function getMainCategory(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "personal";
  
  const categoryTags = ["work", "personal", "health"];
  const found = tags.find(tag => categoryTags.includes(normalizeTag(tag)));
  
  return found ? normalizeTag(found) : "other";
}

/**
 * Merge tags ensuring category tag exists
 * @param {string[]} tags - User provided tags
 * @param {string} category - Category to ensure exists
 * @returns {string[]} Merged tags with category
 */
export function ensureCategoryTag(tags, category) {
  const normalized = normalizeTags(tags);
  const categoryTag = categoryToTag(category);
  
  if (!normalized.includes(categoryTag)) {
    return [categoryTag, ...normalized];
  }
  
  return normalized;
}

// ============================================
// Status Lifecycle System
// ============================================

/**
 * Valid status values for reminders
 * @type {string[]}
 */
export const REMINDER_STATUSES = ["pending", "in_progress", "completed", "snoozed"];

/**
 * Valid state transitions for reminder status
 * Maps current status to array of allowed next statuses
 */
export const STATUS_TRANSITIONS = {
  pending: ["in_progress", "completed", "snoozed"],
  in_progress: ["completed", "snoozed", "pending"],
  completed: ["pending"], // Allow re-opening
  snoozed: ["pending", "in_progress"],
};

/**
 * Status display configuration
 */
export const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    labelZh: "待處理",
    icon: "clock",
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  },
  in_progress: {
    label: "In Progress",
    labelZh: "進行中",
    icon: "play",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  },
  completed: {
    label: "Completed",
    labelZh: "已完成",
    icon: "check",
    color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
  },
  snoozed: {
    label: "Snoozed",
    labelZh: "已延後",
    icon: "pause",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
  },
};

/**
 * Validate if a status value is valid
 * @param {string} status - Status to validate
 * @returns {boolean}
 */
export function isValidStatus(status) {
  return REMINDER_STATUSES.includes(status);
}

/**
 * Check if a status transition is allowed
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {boolean}
 */
export function isValidStatusTransition(fromStatus, toStatus) {
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) return false;
  if (fromStatus === toStatus) return true; // No change is always valid
  return STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
}

/**
 * Get status display config
 * @param {string} status - Status value
 * @returns {object} Status configuration
 */
export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

/**
 * Get status color classes
 * @param {string} status - Status value
 * @returns {string} Tailwind classes
 */
export function getStatusClasses(status) {
  return getStatusConfig(status).color;
}

/**
 * Derive status from legacy completed boolean
 * For backward compatibility during migration
 * @param {boolean} completed - Legacy completed field
 * @returns {string} Status value
 */
export function deriveStatusFromCompleted(completed) {
  return completed ? "completed" : "pending";
}

/**
 * Derive completed boolean from status
 * For backward compatibility
 * @param {string} status - Status value
 * @returns {boolean}
 */
export function deriveCompletedFromStatus(status) {
  return status === "completed";
}

// ============================================
// Duration / Time Blocking Utilities
// ============================================

/**
 * Common duration presets (in minutes)
 */
export const DURATION_PRESETS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
];

/**
 * Format duration in minutes to human readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "";
  
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Validate duration value
 * @param {number} duration - Duration in minutes
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateDuration(duration) {
  if (duration === null || duration === undefined) {
    return { isValid: true }; // Optional field
  }
  
  if (typeof duration !== "number" || isNaN(duration)) {
    return { isValid: false, error: "Duration must be a number" };
  }
  
  if (duration < 0) {
    return { isValid: false, error: "Duration cannot be negative" };
  }
  
  if (duration > 1440) { // 24 hours max
    return { isValid: false, error: "Duration cannot exceed 24 hours (1440 minutes)" };
  }
  
  return { isValid: true };
}

/**
 * Calculate end time given start time and duration
 * @param {Date|string} startTime - Start datetime
 * @param {number} durationMinutes - Duration in minutes
 * @returns {Date} End datetime
 */
export function calculateEndTime(startTime, durationMinutes) {
  const start = new Date(startTime);
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Check if two time blocks overlap
 * @param {Date} start1 - First block start
 * @param {number} duration1 - First block duration (minutes)
 * @param {Date} start2 - Second block start
 * @param {number} duration2 - Second block duration (minutes)
 * @returns {boolean}
 */
export function hasTimeOverlap(start1, duration1, start2, duration2) {
  const end1 = calculateEndTime(start1, duration1 || 30); // Default 30 min
  const end2 = calculateEndTime(start2, duration2 || 30);
  
  return start1 < end2 && start2 < end1;
}
