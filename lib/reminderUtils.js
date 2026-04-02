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

export function apiSuccess(data, status = 200, pagination = null) {
  const body = { success: true, data };
  if (pagination) {
    body.pagination = pagination;
  }
  return NextResponse.json(body, { status });
}

export function apiError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Validate length constraints on reminder fields.
 * Returns an apiError Response if invalid, or null if all checks pass.
 */
export function validateReminderFields({ title, description, remark, tags }) {
  if (title && title.length > 200) {
    return apiError("Title must be 200 characters or less", 400);
  }
  if (description && description.length > 5000) {
    return apiError("Description must be 5000 characters or less", 400);
  }
  if (remark && remark.length > 2000) {
    return apiError("Remark must be 2000 characters or less", 400);
  }
  if (tags && (tags.length > 20 || tags.some((t) => t.length > 50))) {
    return apiError("Too many tags or tag too long", 400);
  }
  return null;
}
