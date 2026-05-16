"use client";
import { useMemo, useCallback, useState, useEffect } from "react";
import { SECTION_IDS } from "@/lib/dnd.js";
import { groupTasksBySection } from "@/lib/dashboard/sectionGrouping.js";

export function msUntilNextMidnight(from) {
  const next = new Date(from);
  next.setHours(24, 0, 0, 100);
  return next.getTime() - from.getTime();
}

export function useTaskSections({ tasks, completingIds }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setTimeout(() => setNow(new Date()), msUntilNextMidnight(now));
    return () => clearTimeout(id);
  }, [now]);

  const sections = useMemo(
    () => groupTasksBySection({ tasks, completingIds, now }),
    [tasks, completingIds, now],
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
