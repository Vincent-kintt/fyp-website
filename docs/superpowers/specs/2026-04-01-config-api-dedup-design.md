# Phase B2: Config Consolidation + API Route Deduplication

**Date:** 2026-04-01
**Goal:** Eliminate remaining copy-pasted config objects and duplicated API route logic. Every config has a single source of truth; every shared transform is defined once.

## Scope

Config extraction + API helper extraction. No logic changes, no UI changes, no new features.

## 1. `getCategoryColor` — Extract to `lib/taskConfig.js`

Two components define local `getCategoryColor` with slightly different styles:
- `DayTimeline.js`: includes `border-*` classes (e.g., `bg-primary-light border-primary/30 text-primary`)
- `ReminderCard.js`: no border classes (e.g., `bg-primary-light text-primary`)

**Solution:** Single function in `lib/taskConfig.js` with a `variant` parameter:

```js
const CATEGORY_COLORS = {
  work:     { base: "bg-primary-light text-primary",     border: "border-primary/30" },
  personal: { base: "bg-success-light text-success",     border: "border-success/30" },
  health:   { base: "bg-danger-light text-danger",       border: "border-danger/30" },
  other:    { base: "bg-background-tertiary text-text-secondary", border: "border-border" },
};

export function getCategoryColor(category, { withBorder = false } = {}) {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return withBorder ? `${c.base} ${c.border}` : c.base;
}
```

- `DayTimeline.js` calls `getCategoryColor(cat, { withBorder: true })`
- `ReminderCard.js` calls `getCategoryColor(cat)`
- Both delete their local definitions.

## 2. `priorityConfig` — Canonical source in `lib/taskConfig.js`

Three definitions with different shapes:

| Location | Fields |
|----------|--------|
| `lib/utils.js` (internal) | `label`, `dotColor`, `textColor`, `selectedBg` |
| `reminders/[id]/page.js` | `label`, `color` (combined badge class, hardcoded colors) |
| `QuickAdd.js` | `label`, `labelZh`, `color` (combined badge class, design tokens) |

**Solution:** One canonical object in `lib/taskConfig.js` with all fields:

```js
export const PRIORITY = {
  high: {
    label: "High",
    labelZh: "高",
    dotColor: "bg-danger",
    textColor: "text-danger",
    selectedBg: "bg-danger/8 border-danger/20",
    badgeClass: "bg-danger/15 text-danger border border-danger/30",
  },
  medium: {
    label: "Medium",
    labelZh: "中",
    dotColor: "bg-warning",
    textColor: "text-warning",
    selectedBg: "bg-warning/8 border-warning/20",
    badgeClass: "bg-warning/15 text-warning border border-warning/30",
  },
  low: {
    label: "Low",
    labelZh: "低",
    dotColor: "bg-success",
    textColor: "text-success",
    selectedBg: "bg-success/8 border-success/20",
    badgeClass: "bg-success/15 text-success border border-success/30",
  },
};

export function getPriority(level) {
  return PRIORITY[level] || PRIORITY.medium;
}
```

Consumers import and pick the fields they need:
- `lib/utils.js`: replace internal `PRIORITY_CONFIG` and `getPriorityConfig` with imports from `lib/taskConfig.js`
- `reminders/[id]/page.js`: delete local `priorityConfig`, use `getPriority(p).badgeClass`
- `QuickAdd.js`: delete local `PRIORITY_CONFIG`, import `PRIORITY` from `lib/taskConfig.js`

## 3. `formatDate` — Distinct named formatters in `lib/format.js`

Three implementations with genuinely different behavior. Do NOT merge them. Give each a clear name:

```js
import { format } from "date-fns";

// For ToolResultCard — bilingual, null-safe, guards epoch dates
export function formatDateCompact(dateTime, language = "en") {
  if (!dateTime) return language === "zh" ? "未設定" : "No date";
  const d = new Date(dateTime);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970)
    return language === "zh" ? "未設定" : "No date";
  return d.toLocaleDateString(language === "zh" ? "zh-TW" : "en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// For GlobalSearch — short format, date-fns
export function formatDateShort(dateTime) {
  try { return format(new Date(dateTime), "MMM dd, hh:mm a"); }
  catch { return ""; }
}

// For reminders/[id] detail page — full format with year
export function formatDateFull(dateTime) {
  return format(new Date(dateTime), "MMMM dd, yyyy 'at' hh:mm a");
}
```

Each consumer imports only its specific formatter:
- `ToolResultCard.js`: delete local `formatDate`, import `formatDateCompact`
- `GlobalSearch.js`: delete local `formatDate`, import `formatDateShort`
- `reminders/[id]/page.js`: delete local `formatDateTime`, import `formatDateFull`

## 4. `formatReminder` — Extract to `lib/reminderUtils.js`

The `[id]/route.js` file has 4 copies of the response formatting block. Three are full (21 fields), one is stripped (DELETE response, 10 fields).

**Solution:** One `formatReminder(doc)` function:

```js
export function formatReminder(doc) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    remark: doc.remark || "",
    dateTime: doc.dateTime,
    duration: doc.duration || null,
    category: doc.category || getMainCategory(doc.tags),
    tags: doc.tags || [],
    recurring: doc.recurring,
    recurringType: doc.recurringType,
    status: doc.status || deriveStatusFromCompleted(doc.completed),
    completed: doc.completed || false,
    snoozedUntil: doc.snoozedUntil || null,
    startedAt: doc.startedAt || null,
    completedAt: doc.completedAt || null,
    priority: doc.priority || "medium",
    subtasks: doc.subtasks || [],
    sortOrder: doc.sortOrder || 0,
    notificationSent: doc.notificationSent || false,
    username: doc.username,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
```

Note: The PUT handler currently calls `.toISOString()` on date fields, but GET and PATCH don't. This inconsistency should be resolved — use raw values consistently (Next.js `Response.json()` serializes Date objects automatically). The `formatReminder` function uses raw values.

The DELETE response (stripped) stays inline since it's intentionally different (minimal response for a deleted resource).

Also add API response helpers:
```js
export function apiSuccess(data, status = 200) {
  return Response.json({ success: true, data }, { status });
}
export function apiError(message, status = 500) {
  return Response.json({ success: false, error: message }, { status });
}
```

Replace `NextResponse.json({ success: true, data: ... })` calls with `apiSuccess(data)`.
Also apply to `app/api/reminders/route.js` (the list endpoint).

## 5. `normalizeSubtasks` — Extract to `lib/reminderUtils.js`

6 copies with behavioral differences:

| Caller | Preserves `st.id` | Handles string `st` | Extra ID segment |
|--------|-------------------|---------------------|------------------|
| API routes (3 copies) | Yes | No | — |
| AI tools create | No (always fresh) | Yes | — |
| AI tools update | Yes | Yes | — |
| AI tools bulk create | No (always fresh) | Yes | `docIdx` |

**Solution:** One function with options:

```js
export function normalizeSubtasks(subtasks, { preserveIds = true, batchIndex } = {}) {
  if (!Array.isArray(subtasks)) return [];
  return subtasks.map((st, idx) => {
    const title = typeof st === "string" ? st : (st.title || "");
    const completed = typeof st === "string" ? false : (st.completed || false);
    const idSuffix = batchIndex != null ? `${batchIndex}-${idx}` : `${idx}`;
    const id = (preserveIds && typeof st === "object" && st.id)
      ? st.id
      : `st-${Date.now()}-${idSuffix}`;
    return { id, title, completed };
  });
}
```

Callers:
- API routes: `normalizeSubtasks(subtasks)` (default: preserveIds=true)
- AI create tool: `normalizeSubtasks(subtasks, { preserveIds: false })`
- AI update tool: `normalizeSubtasks(subtasks)` (preserveIds=true, handles strings automatically)
- AI bulk create: `normalizeSubtasks(subtasks, { preserveIds: false, batchIndex: docIdx })`

## Files Created

- `lib/taskConfig.js` — `getCategoryColor`, `PRIORITY`, `getPriority`
- `lib/format.js` — `formatDateCompact`, `formatDateShort`, `formatDateFull`
- `lib/reminderUtils.js` — `formatReminder`, `normalizeSubtasks`, `apiSuccess`, `apiError`

## Files Modified

- `components/calendar/DayTimeline.js` — delete local `getCategoryColor`, import from taskConfig
- `components/reminders/ReminderCard.js` — delete local `getCategoryColor`, import from taskConfig
- `app/reminders/[id]/page.js` — delete local `priorityConfig` and `formatDateTime`, import from taskConfig/format
- `components/tasks/QuickAdd.js` — delete local `PRIORITY_CONFIG`, import from taskConfig
- `lib/utils.js` — remove internal `PRIORITY_CONFIG` and `getPriorityConfig`, re-export from taskConfig
- `components/reminders/ToolResultCard.js` — delete local `formatDate`, import `formatDateCompact`
- `components/search/GlobalSearch.js` — delete local `formatDate`, import `formatDateShort`
- `app/api/reminders/route.js` — use `normalizeSubtasks`, `apiSuccess`, `apiError`
- `app/api/reminders/[id]/route.js` — use `formatReminder`, `normalizeSubtasks`, `apiSuccess`, `apiError`
- `lib/ai/tools.js` — use `normalizeSubtasks` with appropriate options

## Out of Scope

- Splitting large files (AIReminderModal, dashboard) — Phase C
- i18n standardization
- parse-task route refactoring
