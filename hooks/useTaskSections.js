"use client";
import { useMemo, useCallback } from "react";
import { SECTION_IDS } from "@/lib/dnd.js";
import { groupTasksBySection } from "@/lib/dashboard/sectionGrouping.js";

export function useTaskSections({ tasks, completingIds }) {
  const sections = useMemo(
    () => groupTasksBySection({ tasks, completingIds, now: new Date() }),
    [tasks, completingIds],
  );

  const getSectionTasks = useCallback(
    (sectionId) => {
      switch (sectionId) {
        case SECTION_IDS.OVERDUE: return sections.overdueTasks;
        case SECTION_IDS.TODAY: return sections.todayTasks;
        case SECTION_IDS.TOMORROW: return sections.tomorrowTasks;
        case SECTION_IDS.THIS_WEEK: return sections.thisWeekTasks;
        case SECTION_IDS.SNOOZED: return sections.snoozedTasks;
        case SECTION_IDS.COMPLETED: return sections.completedToday;
        default: return [];
      }
    },
    [sections],
  );

  return { ...sections, getSectionTasks };
}
