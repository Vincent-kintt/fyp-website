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
