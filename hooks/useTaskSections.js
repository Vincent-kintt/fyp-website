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
  // midnightTick forces a recompute when the day rolls over even if tasks/completingIds
  // are unchanged. The actual `now` is read inside the useMemo callback so that intra-day
  // task mutations recompute with the current time (otherwise nextTask would compare
  // against a stale `now` captured at mount).
  const [midnightTick, setMidnightTick] = useState(0);

  useEffect(() => {
    const id = setTimeout(
      () => setMidnightTick((n) => n + 1),
      msUntilNextMidnight(new Date()),
    );
    return () => clearTimeout(id);
  }, [midnightTick]);

  const sections = useMemo(
    () => groupTasksBySection({ tasks, completingIds, now: new Date() }),
    // midnightTick is an intentional trigger: `now` is read fresh inside the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, completingIds, midnightTick],
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
