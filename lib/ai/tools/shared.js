import { ObjectId } from "mongodb";
import { formatInTimezone, naiveToUTC } from "@/lib/ai/dateUtils.js";

export function parseObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

// AI SDK v6: toModelOutput must return { type: 'text', value: string } | { type: 'json', value: JSONValue }
export function textOutput(obj) {
  return {
    type: "text",
    value: typeof obj === "string" ? obj : JSON.stringify(obj),
  };
}

export function projectReminder(r, timezone) {
  const dateStr = r.dateTime
    ? formatInTimezone(new Date(r.dateTime), timezone)
    : "No date";
  return {
    id: r._id?.toString(),
    title: r.title,
    dateTime: dateStr,
    status: r.status,
    priority: r.priority,
    tags: r.tags,
    duration: r.duration,
  };
}

export function makeToolContext({ userId, userTimezone = null }) {
  return {
    userId,
    userTimezone,
    project: (r) => projectReminder(r, userTimezone),
    toUTC: (dt) => naiveToUTC(dt, userTimezone),
  };
}

// AI tools own user identity only as `userId` — there's no session in the
// streaming runtime once createTools(userId) has been called. buildReminderDoc
// expects a session-shaped object for `userId`/`username` stamping; this
// helper synthesises that shape so AI writes stay aligned with the HTTP routes
// without leaking the factory's session knowledge into every tool file.
export function sessionFromCtx(ctx) {
  return {
    user: { id: ctx.userId, username: ctx.username ?? "ai" },
  };
}
