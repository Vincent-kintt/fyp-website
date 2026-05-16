/**
 * Build the POST body for /api/reminders from an extracted inbox task.
 *
 * inboxState is "processed" when the task has a concrete dateTime, otherwise
 * "inbox" — this preserves the previous handler behavior so a dateless task
 * routes back to the inbox queue and a dated one becomes a normal reminder.
 */
export function buildInboxReminderPayload(task) {
  const hasDate = !!task.dateTime;
  return {
    title: task.title,
    dateTime: task.dateTime || null,
    priority: task.priority || "medium",
    tags: task.tags || [],
    inboxState: hasDate ? "processed" : "inbox",
  };
}
