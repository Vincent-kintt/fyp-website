// Pure shape factory for reminder document writes.
//
// Used by POST /api/reminders, PUT /api/reminders/[id], PATCH /api/reminders/[id]
// (and in P1c, the AI tool write paths). Single source of truth for default
// values, dateTime/tags/subtasks/category normalization, inboxState promotion,
// and the H3 fix: notificationSent only resets when patch.dateTime moves the
// stored time — title-only edits MUST NOT clear the flag, or the next cron tick
// will re-deliver a push for an already-fired past-due reminder.
//
// The factory does NOT own:
//   - DB access (it's pure; takes existing/patch in, returns shape out)
//   - Auth / ObjectId parsing (route handlers' job)
//   - zod schema parsing (route handlers call parseJsonBodyWithSchema first)
//   - Status transition authorization (isValidStatusTransition stays in route)
//   - Runtime field validation (validateReminderFields, validateDuration)

import {
  normalizeTags,
  getMainCategory,
  deriveCompletedFromStatus,
} from "@/lib/utils.js";
import { normalizeSubtasks } from "@/lib/reminderUtils.js";

const VALID_MODES = new Set(["create", "put", "patch"]);

export function buildReminderDoc({ existing, patch, mode, session }) {
  if (!VALID_MODES.has(mode)) {
    throw new Error(
      `buildReminderDoc: invalid mode ${JSON.stringify(mode)}; expected one of create|put|patch`,
    );
  }
  if (mode === "create" && !session?.user) {
    throw new Error("buildReminderDoc: create mode requires session.user");
  }
  if ((mode === "put" || mode === "patch") && !existing) {
    throw new Error(`buildReminderDoc: ${mode} mode requires existing`);
  }
  if (!patch) {
    throw new Error("buildReminderDoc: patch is required");
  }

  if (mode === "create") return buildCreatePayload({ patch, session });
  if (mode === "put") return buildPutSet({ existing, patch });
  return buildPatchSet({ existing, patch });
}

function buildCreatePayload({ patch, session }) {
  const processedTags = normalizeTags(patch.tags || []);
  const category =
    patch.category ?? getMainCategory(processedTags) ?? "personal";
  const recurring = patch.recurring ?? false;
  const now = new Date();

  return {
    userId: session.user.id,
    username: session.user.username,
    title: patch.title,
    description: patch.description || "",
    remark: patch.remark || "",
    dateTime: patch.dateTime ? new Date(patch.dateTime) : null,
    inboxState: patch.inboxState ?? "processed",
    duration: patch.duration ?? null,
    category,
    tags: processedTags,
    recurring,
    recurringType: recurring ? (patch.recurringType ?? null) : null,
    priority: patch.priority ?? "medium",
    status: "pending",
    completed: false,
    subtasks: normalizeSubtasks(patch.subtasks),
    sortOrder: patch.sortOrder ?? 0,
    notificationSent: false,
    createdAt: now,
    updatedAt: now,
  };
}

// PUT is full-body replace semantics: every field of the canonical shape is
// written. Mirrors the previous inline updateData in
// app/api/reminders/[id]/route.js PUT handler.
function buildPutSet({ existing, patch }) {
  const processedTags = normalizeTags(patch.tags || []);
  const category =
    patch.category ?? getMainCategory(processedTags) ?? "personal";
  const recurring = patch.recurring ?? false;

  const set = {
    title: patch.title,
    description: patch.description || "",
    remark: patch.remark || "",
    dateTime: patch.dateTime ? new Date(patch.dateTime) : null,
    duration: patch.duration ?? null,
    category,
    tags: processedTags,
    recurring,
    recurringType: recurring ? (patch.recurringType ?? null) : null,
    priority: patch.priority ?? "medium",
    subtasks: normalizeSubtasks(patch.subtasks),
    updatedAt: new Date(),
  };

  if (shouldResetNotificationSent(existing, patch)) {
    set.notificationSent = false;
  }

  if (patch.status !== undefined) {
    applyStatusTransition({ set, existing, nextStatus: patch.status, patch });
  }

  applyInboxPromotion({ set, existing });

  return set;
}

// PATCH is sparse: only fields present in the patch are written. Keys absent
// from the patch must stay absent from $set so they don't accidentally overwrite
// the stored value.
function buildPatchSet({ existing, patch }) {
  const set = { updatedAt: new Date() };

  if (patch.status !== undefined) {
    applyStatusTransition({ set, existing, nextStatus: patch.status, patch });
  } else if (typeof patch.completed === "boolean") {
    applyLegacyCompletedMapping({ set, existing, completed: patch.completed });
  }

  if (patch.duration !== undefined) set.duration = patch.duration;
  if (patch.title) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.remark !== undefined) set.remark = patch.remark;
  if (patch.dateTime !== undefined && patch.dateTime !== null) {
    set.dateTime = new Date(patch.dateTime);
    if (shouldResetNotificationSent(existing, patch)) {
      set.notificationSent = false;
    }
  }
  if (patch.category) set.category = patch.category;
  if (patch.tags !== undefined) set.tags = normalizeTags(patch.tags || []);
  if (patch.priority) set.priority = patch.priority;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  if (patch.subtasks !== undefined) {
    set.subtasks = normalizeSubtasks(patch.subtasks);
  }

  applyInboxPromotion({ set, existing });

  return set;
}

// H3: cron's eligibility filter is { notificationSent: { $ne: true } }, so
// clearing the flag re-arms delivery. Only do that when the user actually
// rescheduled the reminder; renaming or re-saving the same time must not.
function shouldResetNotificationSent(existing, patch) {
  if (patch.dateTime === undefined || patch.dateTime === null) return false;
  const nextMs = new Date(patch.dateTime).getTime();
  const prevMs = existing?.dateTime
    ? new Date(existing.dateTime).getTime()
    : NaN;
  return nextMs !== prevMs;
}

function applyStatusTransition({ set, existing, nextStatus, patch }) {
  const currentStatus = existing.status || "pending";
  set.status = nextStatus;
  set.completed = deriveCompletedFromStatus(nextStatus);

  if (nextStatus === "in_progress" && currentStatus !== "in_progress") {
    set.startedAt = new Date();
  }
  if (nextStatus === "completed" && currentStatus !== "completed") {
    set.completedAt = new Date();
  }
  if (nextStatus === "snoozed" && patch.snoozedUntil) {
    set.snoozedUntil = new Date(patch.snoozedUntil);
  }
  if (currentStatus === "snoozed" && nextStatus !== "snoozed") {
    set.snoozedUntil = null;
  }
}

// Backward-compatibility path for clients sending { completed: boolean }
// directly. Mirrors the legacy mapping in the PATCH handler before the
// extraction.
function applyLegacyCompletedMapping({ set, existing, completed }) {
  const currentStatus = existing.status || "pending";
  const targetStatus = completed
    ? "completed"
    : currentStatus === "completed"
      ? "pending"
      : currentStatus;

  set.completed = completed;
  set.status = targetStatus;

  if (completed) set.completedAt = new Date();
  if (currentStatus === "snoozed" && targetStatus !== "snoozed") {
    set.snoozedUntil = null;
  }
}

function applyInboxPromotion({ set, existing }) {
  if (existing?.inboxState !== "inbox") return;
  if (set.dateTime || set.status === "completed") {
    set.inboxState = "processed";
  }
}
