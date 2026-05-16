import { isSameDay, isSameWeek, addDays, startOfDay } from "date-fns";
import { SECTION_IDS } from "@/lib/dnd.js";

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
 * @param {{
 *   tasks: object[],
 *   completingIds?: Set<string>,
 *   now?: Date,
 *   today?: Date,
 * }} params
 *   - `now` is the current instant; used for nextTask and overdue comparison.
 *   - `today` is the local-midnight reference for "is this task today/tomorrow/this-week".
 *     When omitted it defaults to startOfDay(now). Callers wired to useDayKey should pass
 *     the parsed dayKey here so the reference matches the subscribed day boundary.
 */
export function groupTasksBySection({
  tasks,
  completingIds = new Set(),
  now = new Date(),
  today = startOfDay(now),
}) {
  const tomorrow = addDays(today, 1);

  const datedTasks = tasks.filter((t) => t.dateTime);
  const sortedTasks = [...datedTasks].sort(
    (a, b) => new Date(a.dateTime) - new Date(b.dateTime),
  );

  const isPending = (t) => !t.completed || completingIds.has(t.id);

  const todayTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isSameDay(taskDate, today) && isPending(t) && t.status !== "snoozed";
    }),
  );

  const nextTask =
    todayTasks.find((t) => !t.completed && new Date(t.dateTime) > now) ||
    todayTasks.find((t) => !t.completed);

  const tomorrowTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return isSameDay(taskDate, tomorrow) && isPending(t) && t.status !== "snoozed";
    }),
  );

  const thisWeekTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return (
        isSameWeek(taskDate, today, { weekStartsOn: 1 }) &&
        taskDate >= today &&
        !isSameDay(taskDate, today) &&
        !isSameDay(taskDate, tomorrow) &&
        isPending(t) &&
        t.status !== "snoozed"
      );
    }),
  );

  const completedToday = sortedTasks.filter((t) => {
    if (!t.completed || completingIds.has(t.id)) return false;
    const completedDate = t.completedAt ? new Date(t.completedAt) : null;
    const taskDate = new Date(t.dateTime);
    return (
      isSameDay(taskDate, today) ||
      (completedDate && isSameDay(completedDate, today))
    );
  });

  // Overdue is intentionally *day-granular* — a task scheduled for today at 09:00
  // that isn't done at 14:00 stays in the Today section, NOT here. Same-day-late
  // signals (if needed) belong on the task row or NextTaskCard, not the Overdue bucket.
  const overdueTasks = sortByOrder(
    sortedTasks.filter((t) => {
      const taskDate = new Date(t.dateTime);
      return taskDate < today && isPending(t) && t.status !== "snoozed";
    }),
  );

  const snoozedTasks = sortedTasks.filter(
    (t) => t.status === "snoozed" && !t.completed,
  );

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
