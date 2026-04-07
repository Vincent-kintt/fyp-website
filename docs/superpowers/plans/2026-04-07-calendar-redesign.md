# Calendar Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the calendar page to industry-standard patterns: week view (desktop default), agenda view (mobile default), 30-min time grid, quick add, and proper responsive layout.

**Architecture:** Extract inline calendar code into focused components (MiniCalendar, TimeGrid, EventBlock, ViewTabs). Build four view modes (Day/Week/Month/Agenda) sharing a common TimeGrid. Page.js becomes a thin shell that picks the active view based on breakpoint and user selection.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS 4, @dnd-kit/core, date-fns 4, TanStack Query, next-intl, sonner

**Spec:** `docs/superpowers/specs/2026-04-07-calendar-redesign.md`

---

### Task 1: Add design tokens + i18n keys

**Files:**
- Modify: `app/globals.css`
- Modify: `messages/en.json`
- Modify: `messages/zh-TW.json`

- [ ] **Step 1: Add event-specific CSS custom properties to globals.css**

Find the `:root` or `[data-theme="dark"]` block in `globals.css` and add these tokens alongside existing ones:

```css
--event-bg: rgba(66, 133, 244, 0.15);
--event-border: #4285f4;
--event-text: #4285f4;
--time-indicator: #ef4444;
```

For the light theme block, add:

```css
--event-bg: rgba(66, 133, 244, 0.1);
--event-border: #4285f4;
--event-text: #1a56c4;
--time-indicator: #ef4444;
```

- [ ] **Step 2: Add new calendar i18n keys to en.json**

In the `"calendar"` namespace of `messages/en.json`, add these keys (keep existing keys, add new ones):

```json
"week": "Week",
"agenda": "Agenda",
"day": "Day",
"monthView": "Month",
"allDay": "All day",
"noTasks": "No tasks scheduled",
"quickAddPlaceholder": "Add a task...",
"moreOptions": "More options",
"nMore": "+{count} more",
"now": "Now",
"addTask": "Add new task",
"weekOf": "Week of {start} — {end}"
```

- [ ] **Step 3: Add matching zh-TW keys to zh-TW.json**

```json
"week": "週",
"agenda": "議程",
"day": "日",
"monthView": "月",
"allDay": "全天",
"noTasks": "沒有排程的任務",
"quickAddPlaceholder": "新增任務...",
"moreOptions": "更多選項",
"nMore": "+{count} 項",
"now": "現在",
"addTask": "新增任務",
"weekOf": "{start} — {end} 的週"
```

- [ ] **Step 4: Commit**

```bash
git add app/globals.css messages/en.json messages/zh-TW.json
git commit -m "feat(calendar): add event design tokens and i18n keys"
```

---

### Task 2: Extract MiniCalendar component

**Files:**
- Create: `components/calendar/MiniCalendar.js`
- Test: `tests/unit/calendar/MiniCalendar.test.js`

- [ ] **Step 1: Write failing test for MiniCalendar**

```js
// tests/unit/calendar/MiniCalendar.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MiniCalendar from "@/components/calendar/MiniCalendar";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key) => {
    const map = {
      "days.sun": "Sun", "days.mon": "Mon", "days.tue": "Tue",
      "days.wed": "Wed", "days.thu": "Thu", "days.fri": "Fri", "days.sat": "Sat",
    };
    return map[key] ?? key;
  },
}));

describe("MiniCalendar", () => {
  const defaultProps = {
    currentMonth: new Date(2026, 3, 1), // April 2026
    selectedDate: new Date(2026, 3, 7),
    onMonthChange: vi.fn(),
    onDateSelect: vi.fn(),
    tasksByDate: {},
  };

  it("renders day labels", () => {
    render(<MiniCalendar {...defaultProps} />);
    expect(screen.getByText("Sun")).toBeTruthy();
    expect(screen.getByText("Sat")).toBeTruthy();
  });

  it("renders current month title", () => {
    render(<MiniCalendar {...defaultProps} />);
    expect(screen.getByText("April 2026")).toBeTruthy();
  });

  it("highlights selected date", () => {
    render(<MiniCalendar {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    const day7 = buttons.find((b) => b.textContent === "7");
    expect(day7.className).toContain("selected");
  });

  it("navigates to previous month", () => {
    render(<MiniCalendar {...defaultProps} />);
    const prevBtn = screen.getByLabelText("Previous month");
    fireEvent.click(prevBtn);
    expect(defaultProps.onMonthChange).toHaveBeenCalled();
  });

  it("calls onDateSelect when a day is clicked", () => {
    render(<MiniCalendar {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    const day15 = buttons.find((b) => b.textContent === "15");
    fireEvent.click(day15);
    expect(defaultProps.onDateSelect).toHaveBeenCalled();
  });

  it("shows dot indicator for dates with tasks", () => {
    const props = {
      ...defaultProps,
      tasksByDate: { "2026-04-07": [{ id: "1", title: "Test" }] },
    };
    render(<MiniCalendar {...props} />);
    const buttons = screen.getAllByRole("button");
    const day7 = buttons.find((b) => b.textContent === "7");
    const dot = day7?.querySelector("[data-dot]");
    expect(dot).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/calendar/MiniCalendar.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MiniCalendar**

```js
// components/calendar/MiniCalendar.js
"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function MiniCalendar({
  currentMonth,
  selectedDate,
  onMonthChange,
  onDateSelect,
  tasksByDate = {},
}) {
  const t = useTranslations("calendar");

  const dayLabels = useMemo(
    () => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => t(`days.${d}`)),
    [t],
  );

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);

    const result = [];
    let week = [];
    let day = start;

    while (day <= end) {
      week.push(day);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
      day = addDays(day, 1);
    }
    return result;
  }, [currentMonth]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="p-1.5 rounded-md hover:bg-[var(--background)] transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Previous month"
          >
            <FaChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="p-1.5 rounded-md hover:bg-[var(--background)] transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Next month"
          >
            <FaChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-medium py-1"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5" role="grid">
        {weeks.flat().map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasTasks = (tasksByDate[dateStr]?.length ?? 0) > 0;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(day)}
              className={`
                relative aspect-square flex flex-col items-center justify-center
                rounded-lg text-xs transition-colors
                ${isSelected ? "selected bg-[var(--accent)] text-white font-semibold" : ""}
                ${!isSelected && isTodayDate ? "text-[var(--accent)] font-semibold" : ""}
                ${!isSelected && !isTodayDate && isCurrentMonth ? "text-[var(--text-secondary)] hover:bg-[var(--background)]" : ""}
                ${!isCurrentMonth ? "text-[var(--text-muted)] opacity-40" : ""}
              `}
            >
              {format(day, "d")}
              {hasTasks && (
                <span
                  data-dot
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    isSelected ? "bg-white" : "bg-[var(--accent)]"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/calendar/MiniCalendar.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/calendar/MiniCalendar.js tests/unit/calendar/MiniCalendar.test.js
git commit -m "feat(calendar): extract MiniCalendar component with tests"
```

---

### Task 3: Build TimeGrid + EventBlock components

**Files:**
- Create: `components/calendar/TimeGrid.js`
- Create: `components/calendar/EventBlock.js`
- Create: `lib/calendar.js` (pure helper functions)
- Test: `tests/unit/calendar/calendar.test.js`

- [ ] **Step 1: Write failing tests for calendar helpers**

```js
// tests/unit/calendar/calendar.test.js
import { describe, it, expect } from "vitest";
import {
  getBlockTop,
  getBlockHeight,
  groupOverlappingReminders,
  clipReminderToDay,
  SLOT_HEIGHT,
  HOUR_HEIGHT,
} from "@/lib/calendar";

describe("getBlockTop", () => {
  it("returns 0 for midnight", () => {
    expect(getBlockTop("2026-04-07T00:00")).toBe(0);
  });

  it("returns correct position for 9:30 AM", () => {
    // 9.5 hours * 96px/hour = 912
    expect(getBlockTop("2026-04-07T09:30")).toBe(9.5 * HOUR_HEIGHT);
  });
});

describe("getBlockHeight", () => {
  it("returns 48px for 30-min duration", () => {
    expect(getBlockHeight(30)).toBe(SLOT_HEIGHT);
  });

  it("returns 96px for 60-min duration", () => {
    expect(getBlockHeight(60)).toBe(HOUR_HEIGHT);
  });

  it("returns SLOT_HEIGHT for null duration", () => {
    expect(getBlockHeight(null)).toBe(SLOT_HEIGHT);
  });

  it("returns minimum 28px for very short durations", () => {
    expect(getBlockHeight(5)).toBe(28);
  });
});

describe("clipReminderToDay", () => {
  it("returns full block for same-day reminder", () => {
    const result = clipReminderToDay(
      { dateTime: "2026-04-07T09:00", duration: 60 },
      "2026-04-07",
    );
    expect(result).toEqual({ startMinute: 540, durationMinutes: 60, clipped: false });
  });

  it("clips at midnight for cross-midnight reminder on start day", () => {
    const result = clipReminderToDay(
      { dateTime: "2026-04-07T23:00", duration: 120 },
      "2026-04-07",
    );
    expect(result).toEqual({ startMinute: 1380, durationMinutes: 60, clipped: true });
  });

  it("shows remainder on next day", () => {
    const result = clipReminderToDay(
      { dateTime: "2026-04-07T23:00", duration: 120 },
      "2026-04-08",
    );
    expect(result).toEqual({ startMinute: 0, durationMinutes: 60, clipped: true });
  });

  it("returns null if reminder is not on this day", () => {
    const result = clipReminderToDay(
      { dateTime: "2026-04-07T09:00", duration: 60 },
      "2026-04-09",
    );
    expect(result).toBeNull();
  });
});

describe("groupOverlappingReminders", () => {
  it("returns single column for non-overlapping", () => {
    const reminders = [
      { id: "a", dateTime: "2026-04-07T09:00", duration: 60 },
      { id: "b", dateTime: "2026-04-07T11:00", duration: 60 },
    ];
    const result = groupOverlappingReminders(reminders);
    expect(result.get("a")).toEqual({ column: 0, totalColumns: 1 });
    expect(result.get("b")).toEqual({ column: 0, totalColumns: 1 });
  });

  it("assigns side-by-side columns for overlapping", () => {
    const reminders = [
      { id: "a", dateTime: "2026-04-07T09:00", duration: 60 },
      { id: "b", dateTime: "2026-04-07T09:30", duration: 60 },
    ];
    const result = groupOverlappingReminders(reminders);
    expect(result.get("a").totalColumns).toBe(2);
    expect(result.get("b").totalColumns).toBe(2);
    expect(result.get("a").column).not.toBe(result.get("b").column);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/calendar/calendar.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement calendar helpers**

```js
// lib/calendar.js
import { format, isSameDay, addDays, startOfDay, differenceInMinutes } from "date-fns";

export const SLOT_HEIGHT = 48; // px per 30-min slot
export const HOUR_HEIGHT = SLOT_HEIGHT * 2; // 96px per hour
export const MIN_BLOCK_HEIGHT = 28;
export const TIME_LABEL_WIDTH = 56; // px
export const TOTAL_SLOTS = 48; // 24 hours * 2

// Convert dateTime string to top offset in pixels
export function getBlockTop(dateTime) {
  const d = new Date(dateTime);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return (minutes / 60) * HOUR_HEIGHT;
}

// Convert duration (minutes) to block height in pixels
export function getBlockHeight(duration) {
  if (duration == null) return SLOT_HEIGHT; // no-duration fallback
  const height = (duration / 60) * HOUR_HEIGHT;
  return Math.max(height, MIN_BLOCK_HEIGHT);
}

// Clip a reminder to fit within a single day
export function clipReminderToDay(reminder, dateStr) {
  if (!reminder.dateTime) return null;

  const start = new Date(reminder.dateTime);
  const dur = reminder.duration ?? 30;
  const end = new Date(start.getTime() + dur * 60000);
  const dayStart = new Date(dateStr + "T00:00:00");
  const dayEnd = new Date(dateStr + "T23:59:59");
  const nextDay = addDays(dayStart, 1);

  // Reminder is entirely on the target day
  if (isSameDay(start, dayStart) && end <= nextDay) {
    return {
      startMinute: start.getHours() * 60 + start.getMinutes(),
      durationMinutes: dur,
      clipped: false,
    };
  }

  // Reminder starts on this day but crosses midnight
  if (isSameDay(start, dayStart) && end > nextDay) {
    const clippedDur = differenceInMinutes(nextDay, start);
    return {
      startMinute: start.getHours() * 60 + start.getMinutes(),
      durationMinutes: clippedDur,
      clipped: true,
    };
  }

  // Reminder started yesterday and spills into this day
  if (start < dayStart && end > dayStart && isSameDay(end, dayStart) || (start < dayStart && end > dayStart)) {
    const remainDur = differenceInMinutes(end, dayStart);
    if (remainDur <= 0) return null;
    return {
      startMinute: 0,
      durationMinutes: Math.min(remainDur, 1440),
      clipped: true,
    };
  }

  return null;
}

// Group overlapping reminders into side-by-side columns
export function groupOverlappingReminders(reminders) {
  if (!reminders.length) return new Map();

  const sorted = [...reminders].sort(
    (a, b) => new Date(a.dateTime) - new Date(b.dateTime),
  );

  const result = new Map();
  const clusters = [];
  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevEnd =
      new Date(prev.dateTime).getTime() + (prev.duration ?? 30) * 60000;
    const currStart = new Date(curr.dateTime).getTime();

    if (currStart < prevEnd) {
      currentCluster.push(curr);
    } else {
      clusters.push(currentCluster);
      currentCluster = [curr];
    }
  }
  clusters.push(currentCluster);

  for (const cluster of clusters) {
    const total = cluster.length;
    cluster.forEach((r, i) => {
      result.set(r.id, { column: i, totalColumns: total });
    });
  }

  return result;
}

// Build a map of dateStr -> reminders[] for the mini calendar
export function buildTasksByDate(reminders) {
  const map = {};
  for (const r of reminders) {
    if (!r.dateTime) continue;
    const key = format(new Date(r.dateTime), "yyyy-MM-dd");
    if (!map[key]) map[key] = [];
    map[key].push(r);
  }
  return map;
}

// Get reminders for a specific date
export function getRemindersForDate(reminders, date) {
  if (!date) return [];
  return reminders.filter(
    (r) => r.dateTime && isSameDay(new Date(r.dateTime), date),
  );
}

// Format hour label (e.g., "8 AM", "12 PM")
export function formatHourLabel(hour, locale) {
  if (locale === "zh-TW") return `${hour}:00`;
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h} ${suffix}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/calendar/calendar.test.js`
Expected: PASS

- [ ] **Step 5: Implement EventBlock component**

```js
// components/calendar/EventBlock.js
"use client";

import { format } from "date-fns";

export default function EventBlock({
  reminder,
  top,
  height,
  column = 0,
  totalColumns = 1,
  onClick,
  onToggleComplete,
}) {
  const isCompleted = reminder.status === "completed";
  const isSnoozed = reminder.status === "snoozed";
  const isTask = !reminder.type || reminder.type === "one-time";

  const left = totalColumns > 1 ? `${(column / totalColumns) * 100}%` : "3px";
  const width =
    totalColumns > 1 ? `${(1 / totalColumns) * 100 - 1}%` : "calc(100% - 6px)";

  return (
    <div
      className={`
        absolute rounded-md px-2 py-1 cursor-pointer overflow-hidden
        transition-shadow duration-150
        hover:shadow-md
        ${isCompleted ? "opacity-50" : ""}
      `}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left,
        width,
        background: "var(--event-bg)",
        borderLeft: `3px ${isTask ? "dashed" : "solid"} var(--event-border)`,
        color: "var(--event-text)",
        zIndex: 2,
      }}
      onClick={() => onClick?.(reminder.id)}
    >
      <div
        className={`text-xs font-semibold truncate leading-tight ${
          isCompleted ? "line-through" : ""
        }`}
      >
        {isTask && (
          <span
            className="inline-block w-3 h-3 border-[1.5px] rounded-sm mr-1.5 align-[-1px] cursor-pointer"
            style={{ borderColor: "var(--event-border)" }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete?.(reminder.id, !isCompleted);
            }}
          />
        )}
        {isSnoozed && <span className="mr-1">&#x1F4A4;</span>}
        {reminder.title}
      </div>
      {height >= 40 && reminder.dateTime && (
        <div className="text-[10px] opacity-70 mt-0.5 tabular-nums">
          {format(new Date(reminder.dateTime), "h:mm a")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Implement TimeGrid component**

```js
// components/calendar/TimeGrid.js
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { isToday, format } from "date-fns";
import {
  SLOT_HEIGHT,
  HOUR_HEIGHT,
  TIME_LABEL_WIDTH,
  getBlockTop,
  getBlockHeight,
  clipReminderToDay,
  groupOverlappingReminders,
  formatHourLabel,
} from "@/lib/calendar";
import EventBlock from "./EventBlock";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DEFAULT_SCROLL_HOUR = 7; // scroll to show 8 AM at top with some margin

export default function TimeGrid({
  dates, // array of Date objects (1 for DayView, 7 for WeekView)
  remindersByDate, // { "2026-04-07": [...reminders] }
  onSlotClick, // (dateStr, hour, minute) => void
  onReminderClick, // (reminderId) => void
  onToggleComplete, // (id, completed) => void
  locale = "en",
}) {
  const containerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(null);

  // Hydration-safe current time
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to default hour on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT;
    }
  }, []);

  // Pre-compute overlap groups per date
  const overlapGroups = useMemo(() => {
    const groups = {};
    for (const d of dates) {
      const dateStr = format(d, "yyyy-MM-dd");
      const reminders = remindersByDate[dateStr] ?? [];
      groups[dateStr] = groupOverlappingReminders(reminders);
    }
    return groups;
  }, [dates, remindersByDate]);

  // Current time position
  const currentTimeTop = currentTime
    ? (currentTime.getHours() * 60 + currentTime.getMinutes()) / 60 * HOUR_HEIGHT
    : null;

  const todayStr = currentTime ? format(currentTime, "yyyy-MM-dd") : null;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
      {/* Day headers (sticky) */}
      <div
        className="sticky top-0 z-10 flex border-b border-[var(--card-border)]"
        style={{ background: "var(--card-bg)" }}
      >
        <div
          className="flex-shrink-0 border-r border-[var(--card-border)]"
          style={{ width: TIME_LABEL_WIDTH }}
        />
        {dates.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const isTodayDate = isToday(d);
          return (
            <div
              key={dateStr}
              className="flex-1 text-center py-2 border-r border-[var(--card-border)] last:border-r-0"
            >
              <div
                className={`text-[11px] font-medium uppercase tracking-wider ${
                  isTodayDate ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                }`}
              >
                {format(d, "EEE")}
              </div>
              <div
                className={`text-sm mt-0.5 w-8 h-8 mx-auto flex items-center justify-center rounded-full ${
                  isTodayDate
                    ? "bg-[var(--accent)] text-white font-semibold"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid body */}
      <div className="flex relative">
        {/* Time labels */}
        <div
          className="flex-shrink-0 border-r border-[var(--card-border)]"
          style={{ width: TIME_LABEL_WIDTH }}
        >
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex items-start justify-end pr-2 text-[11px] text-[var(--text-muted)] tabular-nums"
              style={{ height: HOUR_HEIGHT, transform: "translateY(-7px)" }}
            >
              {hour > 0 ? formatHourLabel(hour, locale) : ""}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dates.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const reminders = remindersByDate[dateStr] ?? [];
          const groups = overlapGroups[dateStr] ?? new Map();
          const isTodayCol = dateStr === todayStr;

          return (
            <div
              key={dateStr}
              className={`flex-1 relative border-r border-[var(--card-border)] last:border-r-0 ${
                isTodayCol ? "bg-[var(--accent)]/[0.03]" : ""
              }`}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-[var(--card-border)] relative cursor-pointer hover:bg-[var(--background)]/50"
                  style={{ height: HOUR_HEIGHT }}
                  onClick={() => onSlotClick?.(dateStr, hour, 0)}
                >
                  {/* Half-hour dashed line */}
                  <div
                    className="absolute left-0 right-0 border-b border-dashed border-[var(--card-border)]/50"
                    style={{ top: SLOT_HEIGHT }}
                  />
                </div>
              ))}

              {/* Event blocks */}
              {reminders.map((r) => {
                const clip = clipReminderToDay(r, dateStr);
                if (!clip) return null;
                const top = (clip.startMinute / 60) * HOUR_HEIGHT;
                const height = getBlockHeight(clip.durationMinutes);
                const group = groups.get(r.id) ?? {
                  column: 0,
                  totalColumns: 1,
                };

                return (
                  <EventBlock
                    key={r.id}
                    reminder={r}
                    top={top}
                    height={height}
                    column={group.column}
                    totalColumns={group.totalColumns}
                    onClick={onReminderClick}
                    onToggleComplete={onToggleComplete}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Current time indicator */}
        {currentTimeTop != null && dates.some((d) => isToday(d)) && (
          <div
            className="absolute flex items-center pointer-events-none z-20"
            style={{
              top: currentTimeTop,
              left: TIME_LABEL_WIDTH,
              right: 0,
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full -ml-[5px]"
              style={{ background: "var(--time-indicator)" }}
            />
            <div
              className="flex-1 h-[2px]"
              style={{ background: "var(--time-indicator)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/calendar.js components/calendar/EventBlock.js components/calendar/TimeGrid.js tests/unit/calendar/calendar.test.js
git commit -m "feat(calendar): add TimeGrid, EventBlock, and calendar helpers"
```

---

### Task 4: Build ViewTabs component

**Files:**
- Create: `components/calendar/ViewTabs.js`

- [ ] **Step 1: Implement ViewTabs**

```js
// components/calendar/ViewTabs.js
"use client";

import { useTranslations } from "next-intl";

const VIEW_KEYS = ["day", "week", "monthView", "agenda"];

export default function ViewTabs({ activeView, onViewChange, availableViews }) {
  const t = useTranslations("calendar");
  const views = availableViews ?? VIEW_KEYS;

  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-lg"
      style={{ background: "var(--card-bg)" }}
      role="tablist"
    >
      {views.map((view) => (
        <button
          key={view}
          role="tab"
          aria-selected={activeView === view}
          onClick={() => onViewChange(view)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            activeView === view
              ? "bg-[var(--background)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {t(view)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/ViewTabs.js
git commit -m "feat(calendar): add ViewTabs component"
```

---

### Task 5: Build DayView and WeekView

**Files:**
- Create: `components/calendar/DayView.js`
- Create: `components/calendar/WeekView.js`

- [ ] **Step 1: Implement DayView**

```js
// components/calendar/DayView.js
"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import TimeGrid from "./TimeGrid";
import { getRemindersForDate } from "@/lib/calendar";

export default function DayView({
  date,
  reminders,
  onSlotClick,
  onReminderClick,
  onToggleComplete,
  locale,
}) {
  const dates = useMemo(() => [date], [date]);

  const remindersByDate = useMemo(() => {
    const dateStr = format(date, "yyyy-MM-dd");
    return { [dateStr]: getRemindersForDate(reminders, date) };
  }, [date, reminders]);

  return (
    <TimeGrid
      dates={dates}
      remindersByDate={remindersByDate}
      onSlotClick={onSlotClick}
      onReminderClick={onReminderClick}
      onToggleComplete={onToggleComplete}
      locale={locale}
    />
  );
}
```

- [ ] **Step 2: Implement WeekView**

```js
// components/calendar/WeekView.js
"use client";

import { useMemo } from "react";
import { startOfWeek, addDays, format } from "date-fns";
import TimeGrid from "./TimeGrid";
import { getRemindersForDate } from "@/lib/calendar";

export default function WeekView({
  date, // any date within the target week
  reminders,
  onSlotClick,
  onReminderClick,
  onToggleComplete,
  locale,
}) {
  const dates = useMemo(() => {
    const weekStart = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [date]);

  const remindersByDate = useMemo(() => {
    const map = {};
    for (const d of dates) {
      const dateStr = format(d, "yyyy-MM-dd");
      map[dateStr] = getRemindersForDate(reminders, d);
    }
    return map;
  }, [dates, reminders]);

  return (
    <TimeGrid
      dates={dates}
      remindersByDate={remindersByDate}
      onSlotClick={onSlotClick}
      onReminderClick={onReminderClick}
      onToggleComplete={onToggleComplete}
      locale={locale}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/calendar/DayView.js components/calendar/WeekView.js
git commit -m "feat(calendar): add DayView and WeekView components"
```

---

### Task 6: Build AgendaView, AgendaCard, and WeekStrip for mobile

**Files:**
- Create: `components/calendar/AgendaView.js`
- Create: `components/calendar/AgendaCard.js`
- Create: `components/calendar/WeekStrip.js`

- [ ] **Step 1: Implement AgendaCard**

```js
// components/calendar/AgendaCard.js
"use client";

import { format } from "date-fns";

export default function AgendaCard({ reminder, onToggleComplete, onClick }) {
  const isCompleted = reminder.status === "completed";
  const isTask = !reminder.type || reminder.type === "one-time";
  const startTime = reminder.dateTime
    ? format(new Date(reminder.dateTime), "h:mm a")
    : null;
  const dur = reminder.duration;

  return (
    <div
      className="flex gap-3 p-3.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--background)]"
      style={{
        background: "var(--card-bg)",
        borderLeft: `3px ${isTask ? "dashed" : "solid"} var(--event-border)`,
      }}
      onClick={() => onClick?.(reminder.id)}
    >
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-semibold mb-1 ${
            isCompleted ? "line-through opacity-50" : ""
          }`}
          style={{ color: "var(--text-primary)" }}
        >
          {reminder.title}
        </div>
        <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          {startTime && <span>{startTime}</span>}
          {dur && <span>{dur >= 60 ? `${dur / 60}h` : `${dur}m`}</span>}
        </div>
      </div>
      {isTask && (
        <div
          className="w-5 h-5 border-2 rounded-md flex-shrink-0 mt-0.5 cursor-pointer transition-colors"
          style={{ borderColor: "var(--card-border)" }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.(reminder.id, !isCompleted);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement AgendaView**

```js
// components/calendar/AgendaView.js
"use client";

import { useMemo, useEffect, useState } from "react";
import { format, isToday } from "date-fns";
import { useTranslations } from "next-intl";
import { getRemindersForDate } from "@/lib/calendar";
import AgendaCard from "./AgendaCard";

export default function AgendaView({
  date,
  reminders,
  onReminderClick,
  onToggleComplete,
}) {
  const t = useTranslations("calendar");
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const dayReminders = useMemo(
    () =>
      getRemindersForDate(reminders, date).sort(
        (a, b) => new Date(a.dateTime) - new Date(b.dateTime),
      ),
    [reminders, date],
  );

  // Group by hour
  const grouped = useMemo(() => {
    const groups = [];
    let lastHour = -1;
    for (const r of dayReminders) {
      const hour = new Date(r.dateTime).getHours();
      if (hour !== lastHour) {
        groups.push({ hour, reminders: [r] });
        lastHour = hour;
      } else {
        groups[groups.length - 1].reminders.push(r);
      }
    }
    return groups;
  }, [dayReminders]);

  const isTodayDate = isToday(date);
  const currentHour = currentTime?.getHours();

  if (dayReminders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("noTasks")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24">
      {grouped.map(({ hour, reminders: groupReminders }) => {
        const isNow = isTodayDate && currentHour === hour;
        return (
          <div key={hour}>
            <div
              className={`text-[11px] font-medium uppercase tracking-wider py-2.5 sticky top-0 z-2 ${
                isNow ? "text-[var(--time-indicator)] font-semibold" : "text-[var(--text-muted)]"
              }`}
              style={{ background: "var(--background)" }}
            >
              {format(new Date(2026, 0, 1, hour), "h:mm A")}
              {isNow && (
                <span className="ml-1 text-[9px] tracking-widest">
                  — {t("now").toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 mb-2">
              {groupReminders.map((r) => (
                <AgendaCard
                  key={r.id}
                  reminder={r}
                  onClick={onReminderClick}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Implement WeekStrip**

```js
// components/calendar/WeekStrip.js
"use client";

import { useMemo } from "react";
import { startOfWeek, addDays, format, isSameDay, isToday } from "date-fns";

export default function WeekStrip({ date, selectedDate, onDateSelect, tasksByDate = {} }) {
  const days = useMemo(() => {
    const weekStart = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [date]);

  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto">
      {days.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const isSelected = selectedDate && isSameDay(d, selectedDate);
        const isTodayDate = isToday(d);
        const hasTasks = (tasksByDate[dateStr]?.length ?? 0) > 0;

        return (
          <button
            key={dateStr}
            onClick={() => onDateSelect(d)}
            className={`
              flex-1 min-w-[44px] flex flex-col items-center gap-1.5
              py-2 rounded-xl transition-colors cursor-pointer
              ${isSelected ? "bg-[var(--accent)]" : "hover:bg-[var(--background)]"}
            `}
          >
            <span
              className={`text-[11px] font-medium uppercase ${
                isSelected
                  ? "text-white/70"
                  : isTodayDate
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)]"
              }`}
            >
              {format(d, "EEE")}
            </span>
            <span
              className={`text-lg font-semibold ${
                isSelected
                  ? "text-white"
                  : isTodayDate
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)]"
              }`}
            >
              {format(d, "d")}
            </span>
            <span
              className={`w-1 h-1 rounded-full ${
                hasTasks
                  ? isSelected
                    ? "bg-white"
                    : "bg-[var(--accent)]"
                  : "bg-transparent"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/calendar/AgendaCard.js components/calendar/AgendaView.js components/calendar/WeekStrip.js
git commit -m "feat(calendar): add AgendaView, AgendaCard, and WeekStrip for mobile"
```

---

### Task 7: Build MonthView

**Files:**
- Create: `components/calendar/MonthView.js`

- [ ] **Step 1: Implement MonthView**

```js
// components/calendar/MonthView.js
"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";

const MAX_VISIBLE = 2;

export default function MonthView({
  currentMonth,
  selectedDate,
  onDateSelect,
  tasksByDate = {},
  onViewDay, // switches to DayView for a date
}) {
  const t = useTranslations("calendar");
  const [popoverDate, setPopoverDate] = useState(null);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);

    const result = [];
    let week = [];
    let day = start;

    while (day <= end) {
      week.push(day);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
      day = addDays(day, 1);
    }
    return result;
  }, [currentMonth]);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day labels header */}
      <div className="grid grid-cols-7 border-b border-[var(--card-border)]">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-medium uppercase tracking-wider py-2"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-[var(--card-border)] last:border-b-0">
            {week.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              const dayTasks = tasksByDate[dateStr] ?? [];
              const overflow = dayTasks.length - MAX_VISIBLE;

              return (
                <div
                  key={dateStr}
                  className={`
                    border-r border-[var(--card-border)] last:border-r-0
                    p-1 min-h-[80px] cursor-pointer
                    transition-colors hover:bg-[var(--background)]/50
                    ${!isCurrentMonth ? "opacity-40" : ""}
                  `}
                  onClick={() => {
                    onDateSelect(day);
                    onViewDay?.(day);
                  }}
                >
                  {/* Date number */}
                  <div
                    className={`text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isTodayDate
                        ? "bg-[var(--accent)] text-white font-semibold"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {format(day, "d")}
                  </div>

                  {/* Task bars */}
                  {dayTasks.slice(0, MAX_VISIBLE).map((task) => (
                    <div
                      key={task.id}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate mb-0.5"
                      style={{
                        background: "var(--event-bg)",
                        color: "var(--event-text)",
                      }}
                    >
                      {task.title}
                    </div>
                  ))}

                  {/* Overflow */}
                  {overflow > 0 && (
                    <button
                      className="text-[10px] font-medium px-1.5 cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopoverDate(popoverDate === dateStr ? null : dateStr);
                      }}
                    >
                      {t("nMore", { count: overflow })}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/MonthView.js
git commit -m "feat(calendar): add MonthView with task bars and overflow"
```

---

### Task 8: Build CalendarSidebar and QuickAddPopover

**Files:**
- Create: `components/calendar/CalendarSidebar.js`
- Create: `components/calendar/QuickAddPopover.js`

- [ ] **Step 1: Implement QuickAddPopover**

```js
// components/calendar/QuickAddPopover.js
"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { formatHourLabel } from "@/lib/calendar";

export default function QuickAddPopover({
  dateStr,
  hour,
  minute = 0,
  onSubmit, // ({ title, dateTime }) => void
  onMoreOptions, // ({ title, dateTime }) => void
  onClose,
  locale,
}) {
  const t = useTranslations("calendar");
  const [title, setTitle] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const dateTime = `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const timeLabel = formatHourLabel(hour, locale);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), dateTime });
    onClose();
  };

  return (
    <div
      className="absolute z-30 p-3 rounded-lg shadow-lg border border-[var(--card-border)] w-64"
      style={{ background: "var(--card-bg)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit}>
        <div className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          {timeLabel}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("quickAddPlaceholder")}
          className="w-full bg-transparent border-b border-[var(--card-border)] pb-2 text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="flex items-center justify-between mt-2.5">
          <button
            type="button"
            className="text-[11px] font-medium cursor-pointer"
            style={{ color: "var(--accent)" }}
            onClick={() => {
              onMoreOptions?.({ title: title.trim(), dateTime });
              onClose();
            }}
          >
            {t("moreOptions")}
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="text-[11px] font-medium px-3 py-1 rounded-md cursor-pointer disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "white",
            }}
          >
            {t("addTask")}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Implement CalendarSidebar**

```js
// components/calendar/CalendarSidebar.js
"use client";

import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { useTranslations } from "next-intl";
import MiniCalendar from "./MiniCalendar";
import { getRemindersForDate } from "@/lib/calendar";

export default function CalendarSidebar({
  currentMonth,
  selectedDate,
  reminders,
  tasksByDate,
  onMonthChange,
  onDateSelect,
  onReminderClick,
  onToggleComplete,
  onQuickAdd,
}) {
  const t = useTranslations("calendar");

  const selectedDateReminders = useMemo(
    () =>
      getRemindersForDate(reminders, selectedDate).sort(
        (a, b) => new Date(a.dateTime) - new Date(b.dateTime),
      ),
    [reminders, selectedDate],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Mini Calendar */}
      <div className="p-4">
        <MiniCalendar
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onMonthChange={onMonthChange}
          onDateSelect={onDateSelect}
          tasksByDate={tasksByDate}
        />
      </div>

      {/* Today's tasks */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h3
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          {isToday(selectedDate) ? t("today") : format(selectedDate, "MMM d")}
        </h3>

        {selectedDateReminders.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("noTasks")}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {selectedDateReminders.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors hover:bg-[var(--background)]"
                onClick={() => onReminderClick?.(r.id)}
              >
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: "var(--event-border)" }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-medium truncate ${
                      r.status === "completed" ? "line-through opacity-50" : ""
                    }`}
                    style={{ color: "var(--text-primary)" }}
                  >
                    {r.title}
                  </div>
                  {r.dateTime && (
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {format(new Date(r.dateTime), "h:mm a")}
                    </div>
                  )}
                </div>
                {(!r.type || r.type === "one-time") && (
                  <div
                    className="w-4 h-4 border-[1.5px] rounded flex-shrink-0 mt-0.5 cursor-pointer"
                    style={{ borderColor: "var(--card-border)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete?.(r.id, r.status !== "completed");
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick add */}
      <div className="px-4 pb-4">
        <button
          onClick={onQuickAdd}
          className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-[var(--card-border)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
        >
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>+</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("quickAddPlaceholder")}
          </span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/calendar/QuickAddPopover.js components/calendar/CalendarSidebar.js
git commit -m "feat(calendar): add CalendarSidebar and QuickAddPopover"
```

---

### Task 9: Extend DnD for time-slot drops

**Files:**
- Modify: `lib/dnd.js`
- Test: `tests/unit/calendar/dnd-slots.test.js`

- [ ] **Step 1: Write failing test for slot-level DnD parsing**

```js
// tests/unit/calendar/dnd-slots.test.js
import { describe, it, expect } from "vitest";
import { CALENDAR_SLOT_PREFIX, parseSlotDropId } from "@/lib/dnd";

describe("parseSlotDropId", () => {
  it("parses a valid slot ID", () => {
    const result = parseSlotDropId("cal-slot-2026-04-07-09:30");
    expect(result).toEqual({
      date: expect.any(Date),
      hour: 9,
      minute: 30,
    });
    expect(result.date.toISOString().startsWith("2026-04-07")).toBe(true);
  });

  it("returns null for day-level IDs", () => {
    expect(parseSlotDropId("cal-day-2026-04-07")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseSlotDropId("random-string")).toBeNull();
    expect(parseSlotDropId(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/calendar/dnd-slots.test.js`
Expected: FAIL — `CALENDAR_SLOT_PREFIX` not found

- [ ] **Step 3: Add slot-level DnD helpers to lib/dnd.js**

Add these exports at the end of `lib/dnd.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/calendar/dnd-slots.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/dnd.js tests/unit/calendar/dnd-slots.test.js
git commit -m "feat(calendar): extend DnD with time-slot-level drop support"
```

---

### Task 10: Rewrite calendar page.js as thin shell

**Files:**
- Modify: `app/[locale]/(app)/calendar/page.js`

- [ ] **Step 1: Rewrite page.js**

Replace the entire contents of `app/[locale]/(app)/calendar/page.js` with the new thin shell. This is the integration point that wires all components together.

```js
// app/[locale]/(app)/calendar/page.js
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useTasks } from "@/hooks/useTasks";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import {
  useDndSensors,
  DROP_ANIMATION_CONFIG,
  patchReminderStatus,
  parseDayDropId,
  parseSlotDropId,
  computeNewDateTime,
  computeSlotDateTime,
} from "@/lib/dnd";
import { buildTasksByDate } from "@/lib/calendar";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import ViewTabs from "@/components/calendar/ViewTabs";
import DayView from "@/components/calendar/DayView";
import WeekView from "@/components/calendar/WeekView";
import MonthView from "@/components/calendar/MonthView";
import AgendaView from "@/components/calendar/AgendaView";
import WeekStrip from "@/components/calendar/WeekStrip";
import QuickAddPopover from "@/components/calendar/QuickAddPopover";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

function useBreakpoint() {
  const [bp, setBp] = useState("desktop");
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setBp(w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return bp;
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("calendar");
  const { tasks, loading, toggleComplete, deleteTask, quickAdd, refetch } = useTasks();
  const bp = useBreakpoint();

  // State
  const [currentMonth, setCurrentMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState(null); // set after hydration
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [quickAddSlot, setQuickAddSlot] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);

  const sensors = useDndSensors();
  const queryClient = useQueryClient();

  // Hydration-safe init
  useEffect(() => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
    // Default view per breakpoint
    const w = window.innerWidth;
    if (w < 768) setViewMode("agenda");
    else if (w < 1024) setViewMode("day");
    else setViewMode("week");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Derived data
  const tasksByDate = useMemo(() => buildTasksByDate(tasks), [tasks]);

  // Navigation
  const navigateForward = useCallback(() => {
    if (!selectedDate) return;
    if (viewMode === "week") setSelectedDate(addWeeks(selectedDate, 1));
    else if (viewMode === "monthView") setCurrentMonth(addMonths(currentMonth, 1));
    else setSelectedDate(addDays(selectedDate, 1));
  }, [viewMode, selectedDate, currentMonth]);

  const navigateBack = useCallback(() => {
    if (!selectedDate) return;
    if (viewMode === "week") setSelectedDate(subWeeks(selectedDate, 1));
    else if (viewMode === "monthView") setCurrentMonth(subMonths(currentMonth, 1));
    else setSelectedDate(subDays(selectedDate, 1));
  }, [viewMode, selectedDate, currentMonth]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  }, []);

  // Quick add
  const handleSlotClick = useCallback((dateStr, hour, minute) => {
    setQuickAddSlot({ dateStr, hour, minute });
  }, []);

  const handleQuickAddSubmit = useCallback(
    async ({ title, dateTime }) => {
      quickAdd({ title, dateTime, status: "pending" });
    },
    [quickAdd],
  );

  // DnD
  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveDragId(null);
      if (!over) return;

      const draggedTask = tasks.find((t) => t.id === active.id);
      if (!draggedTask) return;

      let newDateTime;

      // Try slot-level first
      const slotData = parseSlotDropId(over.id);
      if (slotData) {
        newDateTime = computeSlotDateTime(slotData);
      } else {
        // Day-level fallback
        const targetDate = parseDayDropId(over.id);
        if (!targetDate) return;
        newDateTime = computeNewDateTime(draggedTask.dateTime, targetDate);
      }

      if (newDateTime === draggedTask.dateTime) return;

      // Optimistic update
      const original = queryClient.getQueryData(reminderKeys.list({}));
      queryClient.setQueryData(
        reminderKeys.list({}),
        tasks.map((t) =>
          t.id === active.id ? { ...t, dateTime: newDateTime } : t,
        ),
      );

      try {
        await patchReminderStatus(active.id, { dateTime: newDateTime });
        toast.success(t("movedTo", { date: format(new Date(newDateTime), "M/d") }));
      } catch {
        queryClient.setQueryData(reminderKeys.list({}), original);
        toast.error(t("moveFailed"));
      }
    },
    [tasks, queryClient, t],
  );

  const handleDragCancel = useCallback(() => setActiveDragId(null), []);

  const activeDragTask = activeDragId
    ? tasks.find((t) => t.id === activeDragId)
    : null;

  // Top bar title
  const topBarTitle = useMemo(() => {
    if (!selectedDate || !currentMonth) return "";
    if (viewMode === "week") {
      const ws = startOfWeek(selectedDate);
      const we = endOfWeek(selectedDate);
      return t("weekOf", {
        start: format(ws, "MMM d"),
        end: format(we, "MMM d"),
      });
    }
    if (viewMode === "monthView") return format(currentMonth, "MMMM yyyy");
    return isToday(selectedDate)
      ? t("today")
      : format(selectedDate, "EEEE, MMM d");
  }, [viewMode, selectedDate, currentMonth, t]);

  // Loading / auth guard
  if (status === "loading" || loading || !currentMonth || !selectedDate || !viewMode) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="skeleton-line h-6 w-32" />
      </div>
    );
  }

  const isMobile = bp === "mobile";
  const showSidebar = bp === "desktop";

  return (
    <div className="flex h-[calc(100dvh-64px)] overflow-hidden">
      {/* Sidebar (desktop only) */}
      {showSidebar && (
        <div
          className="w-[272px] min-w-[272px] border-r border-[var(--card-border)] overflow-hidden"
          style={{ background: "var(--card-bg)" }}
        >
          <CalendarSidebar
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            reminders={tasks}
            tasksByDate={tasksByDate}
            onMonthChange={setCurrentMonth}
            onDateSelect={setSelectedDate}
            onReminderClick={setSelectedTaskId}
            onToggleComplete={toggleComplete}
            onQuickAdd={() =>
              handleSlotClick(format(selectedDate, "yyyy-MM-dd"), 9, 0)
            }
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        {!isMobile && (
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)]"
            style={{ background: "var(--card-bg)" }}
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  {topBarTitle}
                </div>
              </div>
              <button
                onClick={goToToday}
                className="text-xs font-medium px-2.5 py-1 rounded-md border border-[var(--card-border)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("today")}
              </button>
              <div className="flex gap-1">
                <button
                  onClick={navigateBack}
                  className="p-1.5 rounded-md border border-[var(--card-border)] cursor-pointer hover:bg-[var(--background)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <FaChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={navigateForward}
                  className="p-1.5 rounded-md border border-[var(--card-border)] cursor-pointer hover:bg-[var(--background)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <FaChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            <ViewTabs
              activeView={viewMode}
              onViewChange={setViewMode}
              availableViews={
                bp === "tablet"
                  ? ["day", "week", "monthView", "agenda"]
                  : ["day", "week", "monthView", "agenda"]
              }
            />
          </div>
        )}

        {/* Mobile header */}
        {isMobile && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {format(selectedDate, "MMM d")}
              </h2>
              <ViewTabs
                activeView={viewMode}
                onViewChange={setViewMode}
                availableViews={["day", "agenda"]}
              />
            </div>
            <WeekStrip
              date={selectedDate}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              tasksByDate={tasksByDate}
            />
          </div>
        )}

        {/* Active view */}
        <DndContext
          sensors={isMobile ? undefined : sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex-1 overflow-hidden relative" style={{ background: "var(--card-bg)" }}>
            {viewMode === "day" && (
              <DayView
                date={selectedDate}
                reminders={tasks}
                onSlotClick={handleSlotClick}
                onReminderClick={setSelectedTaskId}
                onToggleComplete={toggleComplete}
              />
            )}
            {viewMode === "week" && (
              <WeekView
                date={selectedDate}
                reminders={tasks}
                onSlotClick={handleSlotClick}
                onReminderClick={setSelectedTaskId}
                onToggleComplete={toggleComplete}
              />
            )}
            {viewMode === "monthView" && (
              <MonthView
                currentMonth={currentMonth}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                tasksByDate={tasksByDate}
                onViewDay={(day) => {
                  setSelectedDate(day);
                  setViewMode("day");
                }}
              />
            )}
            {viewMode === "agenda" && (
              <AgendaView
                date={selectedDate}
                reminders={tasks}
                onReminderClick={setSelectedTaskId}
                onToggleComplete={toggleComplete}
              />
            )}

            {/* Quick Add Popover */}
            {quickAddSlot && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setQuickAddSlot(null)}
                />
                <div style={{ position: "absolute", top: 100, left: 100, zIndex: 30 }}>
                  <QuickAddPopover
                    dateStr={quickAddSlot.dateStr}
                    hour={quickAddSlot.hour}
                    minute={quickAddSlot.minute}
                    onSubmit={handleQuickAddSubmit}
                    onMoreOptions={({ title, dateTime }) => {
                      // TODO: open TaskDetailPanel in create mode (Task 11)
                      handleQuickAddSubmit({ title, dateTime });
                    }}
                    onClose={() => setQuickAddSlot(null)}
                  />
                </div>
              </>
            )}
          </div>

          <DragOverlay dropAnimation={DROP_ANIMATION_CONFIG}>
            {activeDragTask ? (
              <div className="px-2 py-1 text-xs font-medium bg-[var(--accent)] text-white rounded shadow-lg max-w-[120px] truncate">
                {activeDragTask.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task detail panel */}
      <TaskDetailPanel
        taskId={selectedTaskId}
        tasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onSave={refetch}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and manually verify the calendar loads**

Run: `npm run dev`

Open `http://localhost:3000/calendar` and verify:
- Desktop: sidebar with mini calendar + week view renders
- Resize to mobile width: week strip + agenda view renders
- View tabs switch between Day/Week/Month/Agenda
- Clicking a reminder opens TaskDetailPanel

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/calendar/page.js
git commit -m "feat(calendar): rewrite page.js as thin shell with all view modes"
```

---

### Task 11: Remove (app) layout max-w wrapper for calendar + cleanup

**Files:**
- Modify: `app/[locale]/(app)/layout.js`

The current `(app)` layout wraps all children in `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`. The calendar needs full-width layout (sidebar + main content fill viewport). Instead of modifying the layout for all pages, the calendar page itself handles its own layout (it uses `h-[calc(100dvh-64px)]` and `flex` to fill the viewport).

- [ ] **Step 1: Verify calendar renders correctly within existing layout**

The calendar page already uses `overflow-hidden` and absolute positioning internally, so the layout's `max-w-7xl` and padding won't visually affect it if the calendar uses the full viewport height. If it does clip or pad incorrectly, the calendar page should override by using negative margins or the layout should conditionally remove padding for the calendar route.

Check by visiting `http://localhost:3000/calendar` — if the sidebar + week view fill the viewport correctly, no layout changes needed.

If the layout padding causes issues, add this to the calendar page's outer div:

```js
// Override the (app) layout padding
className="flex h-[calc(100dvh-64px)] overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -my-8"
```

- [ ] **Step 2: Delete deprecated DayTimeline if no other file imports it**

Run: `grep -r "DayTimeline" --include="*.js" app/ components/ lib/`

If only the old calendar page.js imported it (which we've replaced), delete it:

```bash
rm components/calendar/DayTimeline.js
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(calendar): remove deprecated DayTimeline, clean up layout"
```

---

### Task 12: Add E2E test for calendar

**Files:**
- Create: `e2e/calendar-redesign.spec.js`

- [ ] **Step 1: Write E2E test**

```js
// e2e/calendar-redesign.spec.js
import { test, expect } from "@playwright/test";

test.describe("Calendar Redesign", () => {
  test.beforeEach(async ({ page }) => {
    // Use existing auth setup from e2e/auth.setup.js
    await page.goto("/calendar");
    await page.waitForSelector("[data-testid='calendar-page']", { timeout: 10000 });
  });

  test("renders week view on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Should see day headers (Sun-Sat)
    await expect(page.getByText("Sun")).toBeVisible();
    await expect(page.getByText("Sat")).toBeVisible();
    // Should see time labels
    await expect(page.getByText("8 AM")).toBeVisible();
  });

  test("renders agenda view on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    // Should see week strip
    const weekStrip = page.locator("[data-testid='week-strip']");
    await expect(weekStrip).toBeVisible();
  });

  test("view tabs switch correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Click Month tab
    await page.getByRole("tab", { name: /month/i }).click();
    // Should see month grid
    await expect(page.locator("[data-testid='month-view']")).toBeVisible();
  });
});
```

Note: Add `data-testid="calendar-page"` to the calendar page's outer div, `data-testid="week-strip"` to WeekStrip's outer div, and `data-testid="month-view"` to MonthView's outer div.

- [ ] **Step 2: Run E2E tests**

Run: `npx playwright test e2e/calendar-redesign.spec.js --config e2e/playwright.config.js`

- [ ] **Step 3: Commit**

```bash
git add e2e/calendar-redesign.spec.js components/calendar/WeekStrip.js components/calendar/MonthView.js app/[locale]/(app)/calendar/page.js
git commit -m "test(calendar): add E2E tests for calendar redesign"
```

---

### Task 13: Final verification and lint

- [ ] **Step 1: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass (including new calendar tests)

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors on changed files

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Final commit if any lint/build fixes were needed**

```bash
git add -A
git commit -m "chore(calendar): fix lint and build issues"
```
