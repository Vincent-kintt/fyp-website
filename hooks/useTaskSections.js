"use client";
import { useMemo, useCallback } from "react";
import { SECTION_IDS } from "@/lib/dnd.js";
import { groupTasksBySection } from "@/lib/dashboard/sectionGrouping.js";
import { useDayKey } from "@/hooks/useDayKey.js";

export function useTaskSections({ tasks, completingIds }) {
  const dayKey = useDayKey();

  const sections = useMemo(() => {
    // dayKey is a stable "YYYY-MM-DD" string from useDayKey. Including it in deps
    // ensures the memo re-runs at midnight even when tasks/completingIds are unchanged.
    // new Date() is called here (not outside) so the exact current time is captured
    // at recompute time (needed by groupTasksBySection for nextTask selection).
    void dayKey;
    return groupTasksBySection({ tasks, completingIds, now: new Date() });
  }, [tasks, completingIds, dayKey]);

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
