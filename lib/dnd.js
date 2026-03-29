"use client";

import {
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { startOfDay, addDays } from "date-fns";
import { getSnoozePresets } from "@/lib/utils";

// Shared drop animation config — used by DragOverlay in all pages
export const DROP_ANIMATION_CONFIG = {
  duration: 200,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

// Sensor configuration for desktop + mobile
export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}

// Assign sortOrder values in increments of 1000
export function computeSortOrders(items) {
  return items.map((item, index) => ({
    id: item.id,
    sortOrder: (index + 1) * 1000,
  }));
}

// Batch reorder API call
export async function reorderReminders(items) {
  const response = await fetch("/api/reminders/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) {
    throw new Error("Failed to reorder");
  }
  return response.json();
}

// Single reminder status PATCH
export async function patchReminderStatus(id, body) {
  const response = await fetch(`/api/reminders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Failed to update status");
  }
  return response.json();
}

// Dashboard section identifiers
export const SECTION_IDS = {
  OVERDUE: "section-overdue",
  TODAY: "section-today",
  TOMORROW: "section-tomorrow",
  THIS_WEEK: "section-thisweek",
  SNOOZED: "section-snoozed",
  COMPLETED: "section-completed",
};

// Map section ID to target date (preserves original time)
export function getSectionTargetDate(sectionId) {
  const now = new Date();
  const today = startOfDay(now);

  switch (sectionId) {
    case SECTION_IDS.OVERDUE:
      return today; // Treat drops to OVERDUE as TODAY
    case SECTION_IDS.TODAY:
      return today;
    case SECTION_IDS.TOMORROW:
      return addDays(today, 1);
    case SECTION_IDS.THIS_WEEK:
      return addDays(today, 2);
    default:
      return null; // COMPLETED/SNOOZED operate on status, not dateTime
  }
}

// Map section ID to required status change
export function getSectionTargetStatus(sectionId) {
  switch (sectionId) {
    case SECTION_IDS.COMPLETED:
      return { status: "completed", completed: true };
    case SECTION_IDS.SNOOZED:
      return { status: "snoozed" };
    default:
      return { status: "pending", completed: false };
  }
}

// Check if cross-section drag requires a status change
const STATUS_SECTIONS = new Set([SECTION_IDS.COMPLETED, SECTION_IDS.SNOOZED]);
export function isStatusChangeNeeded(sourceSection, targetSection) {
  if (STATUS_SECTIONS.has(sourceSection) || STATUS_SECTIONS.has(targetSection)) {
    return sourceSection !== targetSection;
  }
  return false;
}

// Smart default snooze time from presets
export function getDefaultSnoozeUntil() {
  const presets = getSnoozePresets();
  const visible = presets.filter((p) => p.show);
  if (visible.length > 0) {
    return visible[0].value.toISOString();
  }
  // Fallback: tomorrow 9 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

// Compute new dateTime: target date + original time
export function computeNewDateTime(originalDateTime, targetDate) {
  const original = new Date(originalDateTime);
  const target = new Date(targetDate);
  target.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return target.toISOString();
}

// Section label for toast messages
export function getSectionLabel(sectionId) {
  switch (sectionId) {
    case SECTION_IDS.OVERDUE:
      return "Today";
    case SECTION_IDS.TODAY:
      return "Today";
    case SECTION_IDS.TOMORROW:
      return "Tomorrow";
    case SECTION_IDS.THIS_WEEK:
      return "This Week";
    case SECTION_IDS.COMPLETED:
      return "已完成";
    case SECTION_IDS.SNOOZED:
      return "已延後";
    default:
      return "";
  }
}

// Per-section drop zone ring colors
export function getSectionDropColor(sectionId) {
  switch (sectionId) {
    case SECTION_IDS.OVERDUE:
      return "ring-2 ring-orange-400/40 bg-orange-400/5";
    case SECTION_IDS.TODAY:
      return "ring-2 ring-blue-400/40 bg-blue-400/5";
    case SECTION_IDS.TOMORROW:
      return "ring-2 ring-green-400/40 bg-green-400/5";
    case SECTION_IDS.THIS_WEEK:
      return "ring-2 ring-purple-400/40 bg-purple-400/5";
    case SECTION_IDS.SNOOZED:
      return "ring-2 ring-amber-400/40 bg-amber-400/5";
    case SECTION_IDS.COMPLETED:
      return "ring-2 ring-gray-400/40 bg-gray-400/5";
    default:
      return "ring-2 ring-primary/40 bg-primary/5";
  }
}
