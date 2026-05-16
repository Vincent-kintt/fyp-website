/**
 * Section grouping logic extracted from dashboard/page.js (lines 149-241).
 * This module is the extraction target for the future useTaskSections hook (C5 split).
 * Production code (dashboard/page.js) is NOT modified — this file is new.
 */

import { isToday, isTomorrow, isThisWeek, startOfDay } from "date-fns";
import { SECTION_IDS } from "@/lib/dnd.js";

/**
 * Sort tasks by sortOrder (ascending), then dateTime as tiebreaker.
 * Mutates the input array (same behaviour as inline dashboard code).
 */
function sortByOrder(arr) {
  return arr.sort((a, b) => {
    const oa = a.sortOrder || 0;
    const ob = b.sortOrder || 0;
    if (oa !== ob) return oa - ob;
    return new Date(a.dateTime) - new Date(b.dateTime);
  });
}

/**
 * Group tasks into dashboard sections.
 *
 * @param {{ tasks: object[], completingIds: Set<string>, now: Date }} params
 * @returns {{
 *   overdueTasks: object[],
 *   todayTasks: object[],
 *   tomorrowTasks: object[],
 *   thisWeekTasks: object[],
 *   snoozedTasks: object[],
 *   completedToday: object[],
 *   nextTask: object | undefined,
 *   taskToSection: Map<string, string>,
 * }}
 */
export function groupTasksBySection({ tasks, completingIds = new Set(), now = new Date() }) {
  // Tasks without dateTime (inbox) are excluded from date-based sections
  const datedTasks = tasks.filter((t) => t.dateTime);
  const sortedTasks = [...datedTasks].sort(
    (a, b) => new Date(a.dateTime) - new Date(b.dateTime),
  );

  // Tasks in completingIds stay in their original section during the completion animation
  const isPending = (t) => !t.completed || completingIds.has(t.id);

  const todayTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isToday(taskDate) && isPending(t) && t.status !== "snoozed";
    }),
  );

  const nextTask =
    todayTasks.find((t) => !t.completed && new Date(t.dateTime) > now) ||
    todayTasks.find((t) => !t.completed);

  const tomorrowTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isTomorrow(taskDate) && isPending(t) && t.status !== "snoozed";
    }),
  );

  const thisWeekTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return (
        isThisWeek(taskDate, { weekStartsOn: 1 }) &&
        taskDate >= startOfDay(now) &&
        !isToday(taskDate) &&
        !isTomorrow(taskDate) &&
        isPending(t) &&
        t.status !== "snoozed"
      );
    }),
  );

  // Completed today: tasks completed today (by completedAt), excluding those still animating
  const completedToday = sortedTasks.filter((t) => {
    if (!t.completed || completingIds.has(t.id)) return false;
    const completedDate = t.completedAt ? new Date(t.completedAt) : null;
    const taskDate = new Date(t.dateTime);
    return isToday(taskDate) || (completedDate && isToday(completedDate));
  });

  const overdueTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return (
        taskDate < startOfDay(now) && isPending(t) && t.status !== "snoozed"
      );
    }),
  );

  const snoozedTasks = sortedTasks.filter(
    (t) => t.status === "snoozed" && !t.completed,
  );

  // Map taskId -> sectionId for drag logic
  const taskToSection = new Map();
  overdueTasks.forEach((t) => taskToSection.set(t.id, SECTION_IDS.OVERDUE));
  todayTasks.forEach((t) => taskToSection.set(t.id, SECTION_IDS.TODAY));
  tomorrowTasks.forEach((t) => taskToSection.set(t.id, SECTION_IDS.TOMORROW));
  thisWeekTasks.forEach((t) => taskToSection.set(t.id, SECTION_IDS.THIS_WEEK));
  snoozedTasks.forEach((t) => taskToSection.set(t.id, SECTION_IDS.SNOOZED));
  completedToday.forEach((t) => taskToSection.set(t.id, SECTION_IDS.COMPLETED));

  return {
    overdueTasks,
    todayTasks,
    tomorrowTasks,
    thisWeekTasks,
    snoozedTasks,
    completedToday,
    nextTask,
    taskToSection,
  };
}
