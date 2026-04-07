# Calendar Page Redesign

Full redesign of the calendar page to align with industry-standard patterns (Google Calendar, Fantastical, Notion Calendar). Addresses responsive issues, non-standard time grid, missing view modes, and poor mobile experience.

## Current State

- Single Day view only, no Week/Month/Agenda
- 2-hour time blocks (non-standard; industry uses 30-min)
- Mobile: Month/Day tab toggle — shows only half the information at a time
- Mini calendar shows only dot indicators, no task text preview
- No quick-add from calendar view
- Components defined inline in page.js (424 lines), hover states via inline JS
- Single `lg` breakpoint, hardcoded `h-[calc(100vh-180px)]`
- Double `max-w` wrapping (layout 7xl + page 6xl) causing padding issues

## Design Decisions

- Color scheme: Google Calendar Standard palette, single default blue (#4285f4) for all events/tasks — no category-based coloring for now
- Task vs Event distinction: dashed left border + checkbox icon on tasks
- Layout model: sidebar + main grid (desktop), week strip + agenda (mobile)
- Time grid: 30-minute intervals, default visible range 8AM-8PM, scrollable to full 24h
- View modes: Day, Week, Month, Agenda
- Quick add: click empty time slot for inline creation

## Architecture

### Desktop Layout (>= 1024px)

```
+--sidebar (272px, collapsible)--+--main content (flex-1)--+
|                                |                         |
|  [Calendar title]              |  [Top bar]              |
|                                |  Month/Year  [Today]    |
|  [Mini Calendar]               |  [Day|Week|Month|Agenda]|
|  Apr 2026 grid                 |  [< >]                  |
|  dots on days with events      |                         |
|                                |  [Day Headers]          |
|  [Today's Tasks]               |  Sun Mon Tue ...        |
|  - task list for selected day  |                         |
|  - shows time + title          |  [All-Day Row]          |
|  - checkbox for tasks          |                         |
|                                |  [Time Grid]            |
|  [+ Quick add task...]         |  30-min rows            |
|                                |  event blocks            |
|                                |  current time indicator  |
+--------------------------------+-------------------------+
```

### Mobile Layout (< 768px)

```
+--full width, single column--+
|                              |
|  [Header: "Apr 7" + icons]  |
|                              |
|  [Week Strip]                |
|  Sun Mon [Tue] Wed Thu ...   |
|  compact horizontal scroll   |
|                              |
|  [Agenda List]               |
|  time label                  |
|  [event card with border]    |
|  time label                  |
|  [task card with checkbox]   |
|  ...                         |
|                              |
|              [+ FAB button]  |
|                              |
|  [Bottom Nav]                |
+------------------------------+
```

### Tablet Layout (768px - 1023px)

- Sidebar hidden by default, accessible via hamburger/drawer
- Main area shows Day view as default
- View tabs available to switch to Week/Month/Agenda

## Components

### New Components

- `components/calendar/WeekView.js` — 7-column time grid with 30-min slots, event block rendering, current time indicator, click-to-add
- `components/calendar/DayView.js` — single-column time grid, reuses slot/event rendering logic from WeekView
- `components/calendar/MonthView.js` — full month grid with event bars (max 2-3 per cell + "+N more" overflow)
- `components/calendar/AgendaView.js` — chronological card list grouped by time, used as mobile default
- `components/calendar/MiniCalendar.js` — extracted from current inline render functions, reusable
- `components/calendar/CalendarSidebar.js` — mini calendar + today's task list + quick add
- `components/calendar/EventBlock.js` — proportional time block with title, time, optional checkbox for tasks
- `components/calendar/TimeGrid.js` — shared time slot grid used by both DayView and WeekView
- `components/calendar/QuickAddPopover.js` — inline popover on time slot click, title field + time auto-filled
- `components/calendar/WeekStrip.js` — mobile horizontal week day selector (like Fantastical DayTicker)
- `components/calendar/AgendaCard.js` — mobile agenda list item with left color border
- `components/calendar/ViewTabs.js` — Day/Week/Month/Agenda toggle tabs

### Modified Components

- `app/[locale]/(app)/calendar/page.js` — complete rewrite, becomes a thin shell that renders sidebar + active view based on viewMode state and breakpoint
- `components/calendar/DayTimeline.js` — deprecated, replaced by DayView + TimeGrid

### Preserved (with modifications)

- DnD system (`@dnd-kit`) — kept but extended. Current `lib/dnd.js` only supports day-level droppable IDs (`cal-day-YYYY-MM-DD`) and preserves original time on drop. New behavior:
  - Week/Day view: droppable IDs become time-slot-level (`cal-slot-YYYY-MM-DD-HH:mm`), drop updates both date and time
  - Month view: keeps day-level droppable IDs (same as current), preserves original time
  - Agenda view: no DnD (read-only list)
  - `computeNewDateTime` in `lib/dnd.js` needs extension to handle slot-level drops
  - Mobile: DnD disabled (touch-only agenda view)
- `TaskDetailPanel` — extended with create mode. Currently only supports editing existing reminders via `taskId`. New: accepts `initialData: { dateTime, title }` prop for creating new reminders (POST instead of PATCH). Falls back to current edit behavior when `taskId` is provided.
- `useTasks` hook — data layer, unchanged
- All API routes — no backend changes needed

## Time Grid Specification

- Row height: 48px per 30-min slot (96px per hour)
- Hour lines: solid `var(--card-border)`
- Half-hour lines: dashed, 50% opacity
- Time labels: right-aligned in 56px left column, showing hour marks only
- Default scroll position: 8 AM (slot index 16)
- Event blocks: positioned absolutely within day column, height proportional to duration
- Minimum event height: 28px (even for <30min events) for tap target accessibility
- No-duration reminders (`duration: null`): render as 30-min default block height (48px) with a subtle indicator (e.g., no bottom border) to distinguish from explicitly 30-min events
- Cross-midnight reminders: clip at 11:59 PM in Day/Week view, show continuation indicator. The remainder appears on the next day's column. In Agenda view, show full duration under the start time.
- Current time: red dot (10px) + red line spanning all columns, positioned by current minute
- Click-to-add: clicking empty slot shows QuickAddPopover at that position

### Event Block Rendering

- Background: `rgba(66, 133, 244, 0.15)` (default blue, 15% opacity)
- Left border: 3px solid `#4285f4`
- Tasks: dashed left border + inline checkbox before title
- Text: event title (12px, 600 weight) + time (10px, 70% opacity)
- Hover: elevation shadow only (no scale — avoids overlap issues with adjacent blocks)
- Overlapping events: side-by-side columns within the same day column, each taking equal width fraction
- Status display: `completed` reminders show strikethrough title + reduced opacity (0.5). `snoozed` show a snooze icon. `pending` and `in_progress` render normally. Checkbox click toggles between `pending` ↔ `completed` (updates status via existing `toggleComplete`).

## View Modes

### Week View (desktop default)

- 7-column grid (Sun-Sat)
- Day headers: day name (uppercase, 11px) + date number (15px, circled if today)
- All-day row: horizontal bars for all-day events (each day shows its own bar; no cross-column spanning)
- Scrollable time grid below headers

### Day View

- Single column, same time grid as week view but wider
- More room for event details and overlapping events

### Month View

- Standard calendar grid (6 rows x 7 columns)
- Each cell shows up to 2-3 event bars with truncated title text
- "+N more" overflow link → click opens a popover showing all events for that day
- Today highlighted with accent circle
- Click date → switches to Day view for that date

### Agenda View (mobile default)

- Chronological scrolling list grouped by time
- Cards with left color border, title, time range, duration
- Tasks show checkbox
- "Now" indicator with current time
- Empty slots show subtle "No events" text
- Pull-to-refresh

## Responsive Breakpoints

| Breakpoint | Layout | Default View |
|---|---|---|
| < 768px | Single column, no sidebar, week strip + agenda | Agenda |
| 768px - 1023px | Sidebar as drawer, main content | Day |
| >= 1024px | Sidebar always visible + main content | Week |

## Mobile-Specific Behavior

- Week strip at top: 7 days, horizontally scrollable, today highlighted with accent fill
- Tapping a day in the strip scrolls agenda to that day's events
- FAB (+) button: fixed bottom-right, positioned above BottomNav with safe-area offset. Note: the existing GlobalAIFab is rendered from the `(app)` layout, not the calendar page. Calendar's quick-add FAB should be positioned to the left of the AI FAB, or replace the AI FAB on the calendar page only via a prop/context.
- View mode tabs on mobile: compact pill toggle in header area (Day / Agenda). Default is Agenda. Day view uses the same TimeGrid component but in single-column mode. Week and Month are desktop/tablet only.
- Sidebar content (mini calendar, task list) accessible via calendar icon in header → opens as bottom sheet or drawer

## Quick Add

Two entry points:
1. Desktop: click empty time slot → inline popover with title field, time pre-filled
2. Mobile: FAB (+) → modal with title field + date/time picker

Both create a task via existing `POST /api/reminders` endpoint. Flow:
1. User types title in QuickAddPopover/modal, hits enter → POST creates the reminder immediately
2. "More options" link → opens TaskDetailPanel in create mode (passes `initialData: { dateTime, title }` instead of `taskId`)
3. TaskDetailPanel create mode uses POST, edit mode uses PATCH (determined by presence of `taskId` prop)

## Existing Design Tokens

All colors use existing CSS custom properties from `globals.css`:
- `var(--card-bg)` for surfaces
- `var(--card-border)` for grid lines
- `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)` for text hierarchy
- `var(--accent)` for primary blue (today highlight, selected state)

Event-specific tokens to add:
- `--event-bg: rgba(66, 133, 244, 0.15)` — event block background
- `--event-border: #4285f4` — event block left border
- `--event-text: #4285f4` (dark mode) / `#1a56c4` (light mode) — event text
- `--time-indicator: #ef4444` — current time line

## i18n

- Day names, month names: use existing `useTranslations("calendar")` keys
- View mode labels (Day/Week/Month/Agenda): add to `messages/en.json` and `messages/zh-TW.json` under `calendar` namespace
- Quick add placeholder: add translation keys
- Time format: respect locale (24h for zh-TW, 12h for en) via existing `lib/format.js` utilities
- Week start: Sunday for both locales (matches current mini calendar behavior). Configurable later if needed.
- Date display: use `formatDate()` from `lib/format.js` which already handles locale-aware formatting (M月d日 for zh-TW, MMM d for en)

## Accessibility

- Mini calendar grid: `role="grid"` with arrow key navigation between dates
- Event blocks: focusable, keyboard-navigable, `aria-label` with event title + time
- Time grid: `aria-label` on each slot for screen readers
- View tabs: `role="tablist"` + `role="tab"` with `aria-selected`
- FAB: `aria-label="Add new task"`
- Current time indicator: `aria-hidden="true"` (decorative)
- Touch targets: minimum 44x44px for all interactive elements
- `prefers-reduced-motion`: disable event block animations

## States

- Loading: skeleton grid matching the active view's structure (week grid skeleton for week view, card list skeleton for agenda)
- Empty: centered message with illustration — "No reminders for this day" + link to quick add
- Error: toast notification via sonner (matches existing pattern), with retry
- Optimistic updates: DnD drop immediately moves the block, rolls back on API failure (matches current behavior)

## Migration Strategy

Incremental, not big-bang. Each phase should leave the calendar functional:

1. Extract MiniCalendar + CalendarSidebar from inline functions (no visual change)
2. Build TimeGrid + EventBlock as standalone components with test data
3. Build DayView using TimeGrid (replaces DayTimeline)
4. Build WeekView using TimeGrid (new, desktop default)
5. Add ViewTabs + view switching logic to page.js
6. Build AgendaView + WeekStrip for mobile
7. Build MonthView
8. Add QuickAddPopover + TaskDetailPanel create mode
9. Extend DnD for time-slot-level drops
10. Wire up responsive breakpoints + FAB positioning
11. Remove deprecated DayTimeline.js, clean up old inline code
12. Verify bottom padding (`pb-20` removal) against actual layout measurements before removing

## Terminology

This spec uses "reminder" consistently to match the data model (`/api/reminders`). In the UI, displayed as "task" per existing translation keys. Do not introduce "event" as a new concept in code — all items are reminders.

## Testing Plan

- Unit tests (Vitest): MiniCalendar date navigation, TimeGrid slot calculation, EventBlock height/position from duration, DnD slot-level ID parsing, cross-midnight clipping logic, no-duration fallback
- Integration tests (Vitest): QuickAddPopover POST flow, TaskDetailPanel create mode, view switching state persistence
- E2E tests (Playwright): week view renders with events, mobile agenda view loads, quick add creates a reminder, DnD moves a reminder to a different time slot, view tabs switch correctly

## Out of Scope

- Per-event/per-category color customization (future enhancement)
- Recurring events display
- Multi-day event spanning across week columns (all-day events show per-day, no cross-column bar)
- Calendar sharing / external calendar sync
- Keyboard shortcuts for navigation
- Touch-based DnD on mobile (agenda is read-only)
