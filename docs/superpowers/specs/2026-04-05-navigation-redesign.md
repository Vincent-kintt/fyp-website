# Navigation Redesign Spec

## Summary

Redesign the app navigation from 5 tabs (Today, Inbox, Calendar, All, Notes) to a responsive layout:
- Mobile: 4-tab bottom nav (Inbox, Today, Calendar, Notes)
- Desktop: Sidebar navigation (Inbox, Today, Calendar, Notes, All Tasks)

Inbox becomes the primary capture surface. AI integration is subtle and inline.

## Motivation

- 5 tabs is too many. Today/Inbox/All have significant overlap — all read from the same task dataset via `useTasks.js`.
- Current Inbox is not a real inbox — no triage state, shows all incomplete tasks sorted.
- Notes has no list view on mobile — `notes/page.js` redirects directly to the first note.
- Navigation structure is identical on mobile and desktop, missing the opportunity for richer desktop navigation.

## Design Decisions

### Mobile: 4-Tab Bottom Nav

Tabs: Inbox / Today / Calendar / Notes

Each tab serves a distinct purpose with no overlap:

**Inbox** — Primary capture surface
- Top: text input area for free-form typing
- AI provides subtle inline suggestion bar when tasks are detected (date, actionable item)
- Suggestion bar has "Add" button and dismiss (X) — no auto-create
- Below input: recent captured items (tasks + notes mixed, ordered by most recent `updatedAt`)
- Default landing: currently `/dashboard` (Today). Consider changing auth redirect to `/inbox` if Inbox becomes the primary workflow entry point. Decision deferred to implementation.

**Today** — Focus dashboard (minimal changes from current)
- Keep existing sections: Overdue, Today, Tomorrow, This Week, Snoozed, Completed Today
- Keep existing drag-and-drop reorder
- Keep existing stats overview and next task card
- Keep Quick Add on Today for convenience (Inbox is the primary capture, but Today Quick Add stays)

**Calendar** — Calendar view (no changes)
- Keep existing month grid + day timeline
- Keep existing drag-and-drop between dates

**Notes** — Note list + editor
- NEW: List view showing all notes with title, preview text, and timestamp
- Preview text: extract first ~80 chars of plain text from BlockNote content
- FAB button for creating new note
- Tap a note to enter the existing BlockNote editor
- Keep existing note editor, tree sidebar, and all note features

### Desktop: Sidebar Navigation

Replace the horizontal top nav links with a persistent left sidebar.

**Sidebar structure:**
- Primary: Inbox (active indicator), Today, Calendar
- Workspace section label
- Secondary: Notes, All Tasks
- Bottom: User avatar + name

**Active state:** Blue left border bar (3px) + blue-soft background

**Sidebar behavior:**
- Fixed width (210px) for v1, collapsible later
- Always visible on md+ (768px+)
- Hidden on mobile (bottom tab bar takes over)

**Desktop Inbox (Phase 1):**
- Same capture-first layout as mobile but with more space
- Larger input area at top
- Captured Tasks section + Notes section below
- Toolbar: page title + Search button + AI Assistant button

**Desktop Inbox (Phase 2 — future):**
- Full document-style editor (BlockNote-based)
- AI highlights actionable phrases inline with subtle underline + background
- "Add all" / individual "Add" for detected tasks
- Capture-document persistence model

### App Shell Changes

The current `app/[locale]/layout.js` renders Navbar + children + BottomNav. This needs restructuring:

**Mobile (<768px):**
- Keep top Navbar but simplify: logo + search + notifications + theme/locale/account
- Remove horizontal nav links from Navbar (handled by bottom tabs)
- BottomNav: 4 tabs instead of 5
- No sidebar

**Desktop (>=768px):**
- Sidebar replaces the horizontal nav links
- Top bar becomes a slim utility bar: search, notifications, theme toggle, locale switcher, account
- No BottomNav

### Removed from Navigation

**All Tasks (/reminders):**
- Removed from mobile bottom nav
- Kept in desktop sidebar under Workspace
- Route still exists, still accessible via direct URL and search
- No code deletion — just nav removal on mobile

**Completed:**
- NOT a new route or view (removed from scope)
- Completed tasks visible within Today's "Completed Today" section
- Completed tasks visible via All Tasks view and search

### AI Integration

- Inbox capture input: AI detects tasks from typed text, shows inline suggestion bar
- Suggestion bar: icon + detected info + "Add" button + dismiss X
- No pulsing dots, no dashed borders, no flashy indicators
- No auto-create — always requires user confirmation
- Confidence thresholds: only show suggestions when detection confidence is high
- Debounce: wait for typing pause before analyzing
- Dismiss: dismissed suggestions don't resurface for the same text
- Existing AI modal (Cmd+J) remains available on all pages
- Existing Quick Add remains available on Inbox

### Design Language

- Fonts: Plus Jakarta Sans (body, 13-14px), Newsreader (display headings), JetBrains Mono (tags, counts, labels)
- Icons: SVG only (Lucide/Feather style), consistent 1.6-1.8 stroke width, no emoji
- Colors: Blue (#5b8def) primary, Amber (#e8a745) warning/tomorrow, Rose (#e86b7a) overdue, Emerald (#4eca8b) notes, Violet (#9b7ce8) calendar
- Spacing: 8px base rhythm
- Touch targets: minimum 44x44px
- Dark theme: all existing CSS variables, no hardcoded hex
- Transitions: 120-150ms ease for hover/active states

## Phasing

### Phase 1 (This PR)

1. App shell restructure
   - Update `app/[locale]/layout.js` to conditionally render sidebar vs bottom nav
   - Simplify Navbar for mobile (remove nav links, keep utility buttons)
   - Create new Sidebar component for desktop
   - Update BottomNav: 4 tabs (Inbox, Today, Calendar, Notes)

2. Inbox capture-first redesign
   - Rewrite `/inbox/page.js` — input area at top, recent items below
   - AI suggestion bar component (reuse existing parse-task API)
   - Mixed feed: aggregate tasks + notes, sorted by recent

3. Notes list view
   - New index page for `/notes/page.js` — list of notes with preview
   - Extract preview text from BlockNote content (first ~80 chars plain text)
   - FAB for new note creation
   - Keep existing editor flow on note selection

4. Navigation cleanup
   - Remove All tab from BottomNav
   - Add All Tasks to desktop sidebar
   - Keep `/reminders` route functional
   - Fix BottomNav semantics: `role="navigation"` with links, not `role="tablist"` with tabs
   - Increase label font size (10px -> 11px minimum)

### Phase 2 (Future)

1. Desktop document-style Inbox with BlockNote editor
2. Inline AI highlighting (editor decoration layer)
3. Capture-document persistence model
4. Collapsible/resizable sidebar
5. Mobile overflow menu for All Tasks access from Inbox

## Files Affected (Phase 1)

| File | Change |
|------|--------|
| `components/layout/BottomNav.js` | 5 tabs -> 4 tabs, fix semantics, adjust sizing |
| `components/layout/Navbar.js` | Remove nav links on desktop, simplify to utility bar |
| `components/layout/Sidebar.js` | NEW — desktop sidebar component |
| `app/[locale]/layout.js` | Conditional sidebar/bottom-nav rendering |
| `app/[locale]/(app)/inbox/page.js` | Rewrite — capture-first with input + mixed feed |
| `app/[locale]/(app)/notes/page.js` | Rewrite — note list with preview |
| `components/notes/NotesLayout.js` | Adjust to work with new notes index |
| `components/inbox/CaptureInput.js` | NEW — input area with AI suggestion bar |
| `components/inbox/SuggestionBar.js` | NEW — inline AI suggestion display |
| `components/inbox/RecentFeed.js` | NEW — mixed tasks + notes feed |
| `messages/en.json` | Add new translation keys |
| `messages/zh-TW.json` | Add new translation keys |

## Risks and Mitigations

- **Notes preview extraction:** BlockNote content is a nested JSON array. Mitigation: write a simple `extractPreview(content)` utility that walks the block tree and concatenates text nodes.
- **Mixed feed ordering:** Tasks from `useTasks` and notes from notes API have different schemas. Mitigation: normalize both into `{ id, type, title, timestamp }` for the feed.
- **Removing All from mobile:** Users lose browsing capability. Mitigation: Phase 2 adds overflow menu. For now, search and desktop sidebar cover the use case.
- **App shell restructure:** Risk of breaking existing layout. Mitigation: use responsive CSS (md breakpoint) to toggle sidebar vs bottom nav, minimal JS changes.
- **AI false positives in Inbox:** Mitigation: confidence threshold, debounce, dismiss button, no auto-create.

## Mockups

Visual mockups saved in `.superpowers/brainstorm/` (this branch):
- Mobile: `mobile-polished.html` — all 4 tabs with full screen mockups
- Desktop: `desktop-polished.html` — sidebar + editor inbox
- Earlier iterations: `hybrid-unified.html`, `things3-direction-v3.html`
