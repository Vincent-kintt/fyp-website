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
