"use client";

import {
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  closestCenter,
  getFirstCollision,
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
  if (!originalDateTime) return targetDate;
  const original = new Date(originalDateTime);
  const target = new Date(targetDate);
  target.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return target.toISOString();
}

// Section label key for i18n (dashboard namespace)
export function getSectionLabelKey(sectionId) {
  switch (sectionId) {
    case SECTION_IDS.OVERDUE:
      return "todaySection";
    case SECTION_IDS.TODAY:
      return "todaySection";
    case SECTION_IDS.TOMORROW:
      return "tomorrow";
    case SECTION_IDS.THIS_WEEK:
      return "thisWeek";
    case SECTION_IDS.COMPLETED:
      return "completedToday";
    case SECTION_IDS.SNOOZED:
      return "snoozed";
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

// Calendar month-view droppable ID prefix
export const CALENDAR_DAY_PREFIX = "cal-day-";

// Parse a droppable ID like "cal-day-2026-04-05" → Date object
export function parseDayDropId(id) {
  if (!id || !id.startsWith(CALENDAR_DAY_PREFIX)) return null;
  const dateStr = id.slice(CALENDAR_DAY_PREFIX.length);
  const parsed = new Date(dateStr + "T00:00:00");
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Section-aware collision detection for Dashboard bidirectional DnD.
// Based on official @dnd-kit MultipleContainers pattern.
// Phase 1: pointerWithin to find which section the pointer is over.
// Phase 2a: Same section → closestCenter scoped to that section's tasks only.
// Phase 2b: Different section → return section as collision target.
export function createSectionAwareCollision(taskToSectionRef) {
  const sectionIds = new Set(Object.values(SECTION_IDS));

  return function sectionAwareCollision(args) {
    const { droppableContainers, active } = args;

    // Partition: section droppables vs task sortables
    const sectionContainers = droppableContainers.filter(({ id }) =>
      sectionIds.has(id),
    );
    const taskContainers = droppableContainers.filter(
      ({ id }) => !sectionIds.has(id),
    );

    // Phase 1: pointerWithin on sections, fallback to rectIntersection
    let sectionCollisions = pointerWithin({
      ...args,
      droppableContainers: sectionContainers,
    });
    if (sectionCollisions.length === 0) {
      sectionCollisions = rectIntersection({
        ...args,
        droppableContainers: sectionContainers,
      });
    }

    const overSectionId = getFirstCollision(sectionCollisions, "id");

    if (overSectionId != null) {
      const activeSection = taskToSectionRef.current.get(active.id);

      if (overSectionId === activeSection) {
        // Phase 2a: Same section → closestCenter on same-section tasks only
        const sameSectionTasks = taskContainers.filter(
          ({ id }) => taskToSectionRef.current.get(id) === activeSection,
        );
        if (sameSectionTasks.length > 0) {
          return closestCenter({
            ...args,
            droppableContainers: sameSectionTasks,
          });
        }
      }

      // Phase 2b: Different section → return section as target
      return sectionCollisions;
    }

    // Fallback: pointer outside all sections — prefer active item's section
    const activeSection = taskToSectionRef.current.get(active.id);
    if (activeSection) {
      const activeSectionTasks = taskContainers.filter(
        ({ id }) => taskToSectionRef.current.get(id) === activeSection,
      );
      if (activeSectionTasks.length > 0) {
        return closestCenter({
          ...args,
          droppableContainers: activeSectionTasks,
        });
      }
    }
    return closestCenter({ ...args, droppableContainers: taskContainers });
  };
}

// Calendar time-slot-level droppable ID prefix
export const CALENDAR_SLOT_PREFIX = "cal-slot-";

// Parse a droppable ID like "cal-slot-2026-04-07-09:30" → { date, hour, minute }
export function parseSlotDropId(id) {
  if (!id || !id.startsWith(CALENDAR_SLOT_PREFIX)) return null;
  const rest = id.slice(CALENDAR_SLOT_PREFIX.length);
  // Format: YYYY-MM-DD-HH:mm
  const match = rest.match(/^(\d{4}-\d{2}-\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const date = new Date(match[1] + "T00:00:00");
  if (isNaN(date.getTime())) return null;
  return { date, hour: parseInt(match[2], 10), minute: parseInt(match[3], 10) };
}

// Compute new dateTime from a slot drop (replaces both date and time)
export function computeSlotDateTime(slotData) {
  const { date, hour, minute } = slotData;
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
