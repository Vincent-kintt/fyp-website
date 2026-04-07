// Shared concurrency guard for all note AI operations (/agent, /rss).
// Only one AI operation per user at a time across all note endpoints.
const activeNoteAIUsers = new Set();

export function acquireNoteAILock(userId) {
  if (activeNoteAIUsers.has(userId)) return false;
  activeNoteAIUsers.add(userId);
  return true;
}

export function releaseNoteAILock(userId) {
  activeNoteAIUsers.delete(userId);
}
