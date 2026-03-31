/**
 * Shared reminder utilities for API routes — formatReminder, normalizeSubtasks, response helpers.
 */
import { NextResponse } from "next/server";
import { getMainCategory, deriveStatusFromCompleted } from "./utils";

export function formatReminder(doc) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    remark: doc.remark || "",
    dateTime: doc.dateTime,
    duration: doc.duration || null,
    category: doc.category || getMainCategory(doc.tags),
    tags: doc.tags || [],
    recurring: doc.recurring,
    recurringType: doc.recurringType,
    status: doc.status || deriveStatusFromCompleted(doc.completed),
    completed: doc.completed || false,
    snoozedUntil: doc.snoozedUntil || null,
    startedAt: doc.startedAt || null,
    completedAt: doc.completedAt || null,
    priority: doc.priority || "medium",
    subtasks: doc.subtasks || [],
    sortOrder: doc.sortOrder || 0,
    notificationSent: doc.notificationSent || false,
    username: doc.username,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function normalizeSubtasks(subtasks, { preserveIds = true, batchIndex } = {}) {
  if (!Array.isArray(subtasks)) return [];
  return subtasks.map((st, idx) => {
    const title = typeof st === "string" ? st : (st.title || "");
    const completed = typeof st === "string" ? false : (st.completed || false);
    const idSuffix = batchIndex != null ? `${batchIndex}-${idx}` : `${idx}`;
    const id =
      preserveIds && typeof st === "object" && st.id
        ? st.id
        : `st-${Date.now()}-${idSuffix}`;
    return { id, title, completed };
  });
}

export function apiSuccess(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}
