"use client";

import {
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { startOfDay, addDays } from "date-fns";

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

// Dashboard section identifiers
export const SECTION_IDS = {
  OVERDUE: "section-overdue",
  TODAY: "section-today",
  TOMORROW: "section-tomorrow",
  THIS_WEEK: "section-thisweek",
  COMPLETED: "section-completed",
};

// Map section ID to target date (preserves original time)
export function getSectionTargetDate(sectionId) {
  const now = new Date();
  const today = startOfDay(now);

  switch (sectionId) {
    case SECTION_IDS.TODAY:
      return today;
    case SECTION_IDS.TOMORROW:
      return addDays(today, 1);
    case SECTION_IDS.THIS_WEEK:
      return addDays(today, 2);
    default:
      return null; // Invalid drop target (overdue, completed)
  }
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
    case SECTION_IDS.TODAY:
      return "Today";
    case SECTION_IDS.TOMORROW:
      return "Tomorrow";
    case SECTION_IDS.THIS_WEEK:
      return "This Week";
    default:
      return "";
  }
}
