# Navigation Redesign — Phase 2 Spec

## Summary

Phase 2 extends the Phase 1 navigation redesign with five features:
1. Collapsible/resizable desktop sidebar
2. Mobile overflow menu for All Tasks access
3. Desktop Inbox as full BlockNote document editor
4. Inline AI task detection and highlighting in the editor
5. Capture-document persistence model

Items 1-2 are small, independent improvements. Items 3-5 form a cohesive "Inbox Editor" feature that transforms the desktop Inbox into an intelligent notebook surface.

## Prerequisites

Phase 1 must be complete: 4-tab mobile bottom nav, desktop sidebar, capture-first Inbox with CaptureInput, Notes list view. All on branch `UI-design`.

---

## Feature 1: Collapsible Desktop Sidebar

### What

The desktop Sidebar (`components/layout/Sidebar.js`, 210px fixed) gains collapse/expand behavior. Collapsed state shows only icons (no labels). User preference persists in localStorage.

### Design

- Collapsed width: 56px (icon + padding)
- Expanded width: 210px (current)
- Toggle button: at top of sidebar, uses a chevron icon
- Transition: 200ms ease-out on width change
- localStorage key: `sidebar-collapsed` (boolean)
- When collapsed: nav items show only Icon (16px), no label text, tooltip on hover showing the label
- Active indicator bar stays visible in both states
- User avatar section: collapsed shows only the avatar circle, no name

### Implementation Approach

Reuse the pattern from `components/notes/NotesLayout.js` (lines 47-105) which already has collapse + localStorage + transition logic. The main app Sidebar is simpler — no resize, just toggle.

### Files Affected

- Modify: `components/layout/Sidebar.js` — add collapse state, toggle button, conditional label rendering

---

## Feature 2: Mobile Overflow Menu for All Tasks

### What

On mobile, users currently can't access All Tasks (removed from bottom nav in Phase 1). Add an overflow menu accessible from the Inbox page header.

### Design

- Small icon button (3 horizontal dots) in the top Navbar utility area (global, not page-local)
- Tapping opens a dropdown with:
  - All Tasks (links to `/reminders`)
  - AI Assistant (opens AI modal)
- Dropdown dismisses on tap outside or selection
- Only visible on mobile (hidden on md+ since sidebar covers these)
- This is a global app-shell element, not tied to a specific page — users can access All Tasks from any page on mobile

### Implementation Approach

Simple dropdown component. No new pages or routes — just linking to existing `/reminders`.

### Files Affected

- Modify: `components/layout/Navbar.js` — add overflow menu button (mobile only)
- No new components needed — inline dropdown with state toggle

---

## Feature 3: Desktop Inbox as BlockNote Editor

### What

On desktop (>=768px), the Inbox transforms from a simple text input into a full BlockNote document editor. Users write freely in a rich text environment. The editor content persists as a "capture document" — a special note tied to the user.

### Why Not Just Reuse CaptureInput on Desktop

The Phase 1 CaptureInput is a single-line `<input>`. For desktop, we want the full writing experience: multi-paragraph, rich text, slash commands, the same editor quality as Notes. This matches the mockup where the desktop Inbox looks like a document.

### Design

**Layout (desktop only):**
- Toolbar: page title "Inbox" + Search button + AI Assistant button
- Editor area: full BlockNote editor, same config as NoteEditor
- Below editor: a divider, then "Captured Tasks" section showing tasks from useTasks()
- Mobile (<768px): keeps the existing CaptureInput + RecentFeed from Phase 1

**Editor behavior:**
- Auto-save every 1000ms (same debounce as NoteEditor)
- Saves to the user's capture document (see Feature 5)
- Slash menu available (/, includes AI commands from NoteEditor)
- No title input — the "document" is always called "Inbox"

**Responsive split:**
```
Mobile:  CaptureInput → RecentFeed (Phase 1, unchanged)
Desktop: BlockNote editor → Captured Tasks section
```

The Inbox page conditionally renders based on screen width. Use a `useMediaQuery("(min-width: 768px)")` hook (client-only, avoids hydration mismatch).

**Breakpoint crossing rule:** Desktop editor owns the capture document; mobile capture stays task-only (creates tasks directly, no document editing). If a user resizes across the md breakpoint, the component simply mounts/unmounts — no state migration between the two experiences. The capture document is fetched fresh when InboxEditor mounts.

### Implementation Approach

- Extract shared editor config from `NoteEditor.js` into a reusable hook or config object
- Create `components/inbox/InboxEditor.js` — wraps BlockNoteView with Inbox-specific behavior
- The Inbox page conditionally renders InboxEditor (desktop) or CaptureInput (mobile)
- InboxEditor reuses BlockNote setup but saves to capture document instead of a note

### Files Affected

- Create: `components/inbox/InboxEditor.js` — BlockNote editor for desktop Inbox
- Create: `hooks/useMediaQuery.js` — responsive breakpoint hook (if not already exists)
- Modify: `app/[locale]/(app)/inbox/page.js` — conditional desktop/mobile rendering
- Modify: `components/notes/NoteEditor.js` — extract reusable editor config (optional, could duplicate)

---

## Feature 4: Inline AI Task Detection and Highlighting

### What

As users type in the Inbox editor (desktop), AI detects actionable phrases and highlights them inline. A floating suggestion bar appears with options to create tasks from detected items.

### Why This Is Hard

BlockNote (v0.47.3) doesn't have a native decoration API for AI highlights. We need to work within its constraints:
- Can use text styles (`backgroundColor`, `textColor`) on inline content
- Can use ProseMirror plugins via `editor._tiptapEditor`
- Cannot easily add interactive buttons inside block content
- Need to avoid disrupting the user's typing experience

### Design

**Detection flow:**
1. User types in the editor
2. After 1200ms pause (debounce), send the current editor text to `/api/ai/parse-task`
3. If tasks detected, highlight the relevant text using BlockNote's `backgroundColor` style
4. Show a floating suggestion panel anchored below the highlighted text
5. User clicks "Add" → task created via quickAdd, highlight removed
6. User clicks "Dismiss" → highlight removed, text stored in dismissed set

**Highlighting approach (ephemeral, NOT persisted):**
- Apply visual highlights via a DOM overlay or ephemeral ProseMirror decoration — NOT via BlockNote's inline `backgroundColor` style, because that would be persisted on auto-save
- Alternative: if using inline styles for simplicity, MUST strip all AI-applied highlights before every save call
- Use a `data-ai-highlight` attribute or a dedicated CSS class to distinguish AI highlights from user-applied styles
- Limitation: can't add interactive elements inside the text, so use a floating panel instead

**Floating suggestion panel:**
- Positioned via floating-ui (e.g., @floating-ui/react), anchored to the paragraph container — NOT to the exact substring (too fragile with line wraps, zoom, editor relayout)
- Shows: detected task title + date + "Add" button + "Dismiss" button
- Same visual style as SuggestionBar from Phase 1 but floating
- Disappears when user starts typing again
- Rendered as a React portal to avoid editor DOM conflicts

**Constraints:**
- Only detect in the most recently typed paragraph (not the entire document)
- Confidence threshold: 0.7 (higher than Phase 1's 0.6 because false positives are more annoying in an editor)
- Maximum 1 active suggestion at a time
- Debounce: 1200ms (longer than Phase 1's 800ms — editor typing is more continuous)
- Never auto-modify content. Highlighting is visual only — removing highlight restores original styling
- Stale response rejection: track request ID, discard results if paragraph changed since request was sent
- IME/composition: skip detection during active IME composition (zh-TW input)
- Dismiss keyed to paragraph content hash, not just raw text — editing a dismissed paragraph re-enables detection

**parse-task API extension needed:**
The current `/api/ai/parse-task` returns only a normalized task object. For editor integration, extend the response to include:
- `isTask` (boolean): explicit signal, not just "always returns a title"
- `matchedText` (string): the exact phrase in the input that triggered detection
- `confidence.overall` (number): single score for gating
- Keep backward compatibility — new fields are additive

### Edge Cases

- User types in the middle of an existing paragraph → only analyze that paragraph
- User deletes highlighted text → dismiss the suggestion
- User undoes → highlight should also be undone (BlockNote handles this via its undo stack since we use text styles)
- Multiple tasks in one paragraph → detect only the first one, show one suggestion at a time

### Implementation Approach

- Create a `useInlineTaskDetection(editor)` hook that:
  - Watches editor content changes
  - Debounces, sends last-changed paragraph to parse-task API
  - Returns `{ highlightedRange, suggestion, dismiss, add }`
- The highlight is applied via `editor.updateBlock()` / inline style manipulation
- The floating panel is a React component positioned via DOM measurement

### Files Affected

- Create: `hooks/useInlineTaskDetection.js` — editor content watcher + parse-task integration
- Create: `components/inbox/FloatingSuggestion.js` — positioned suggestion panel
- Modify: `components/inbox/InboxEditor.js` — integrate the hook + floating panel

---

## Feature 5: Capture Document Persistence

### What

The Inbox editor needs to persist its content between sessions. We create a "capture document" — a special note per user that stores the Inbox editor's content.

### Design

**Data model:**
- Use the existing `notes` collection with a special marker
- Add a field `type: "inbox-capture"` to distinguish from regular notes
- One per user, auto-created on first Inbox visit
- Not shown in the Notes list view or sidebar (filtered out)

**API:**
- `GET /api/inbox/capture` — returns the user's capture document (creates if not exists)
- `PATCH /api/inbox/capture` — updates content (same shape as note PATCH)
- No DELETE — the capture document always exists

**Note fields for capture document:**
```javascript
{
  userId: string,
  title: "Inbox",              // fixed, not editable
  type: "inbox-capture",       // marker field
  content: Array<Block>,       // BlockNote content
  parentId: null,              // no hierarchy
  icon: null,
  sortOrder: 0,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: null              // never deleted
}
```

**Filtering:**
- `GET /api/notes` must exclude documents where `type: "inbox-capture"` (add filter to existing query)
- The Notes list view and sidebar should never show the capture document
- Generic note PATCH/DELETE routes must guard against modifying capture documents via note ID (return 403)
- Trash listing must also filter out capture documents

**Database index:**
- Create unique partial index on `(userId, type)` where `type: "inbox-capture"` to prevent duplicate capture documents per user
- This ensures concurrent first-visit requests can't create two documents

### Implementation Approach

- Add `type` field to note schema (optional, defaults to `null` for regular notes)
- Create two new API routes: `GET /api/inbox/capture` and `PATCH /api/inbox/capture`
- Update `GET /api/notes` to filter out `type: "inbox-capture"` documents
- InboxEditor fetches capture document on mount, saves on content change

### Files Affected

- Create: `app/api/inbox/capture/route.js` — GET + PATCH for capture document
- Modify: `app/api/notes/route.js` — filter out inbox-capture from GET
- Modify: `components/inbox/InboxEditor.js` — fetch/save capture document

---

## Phasing Within Phase 2

### Phase 2a (Small, Independent)
1. Collapsible sidebar
2. Mobile overflow menu

These can ship independently and don't require any backend changes.

### Phase 2b (Inbox Editor Core)
3. Capture document persistence (API + DB)
4. Desktop Inbox as BlockNote editor (frontend)

These are tightly coupled — the editor needs persistence to be useful.

### Phase 2c (AI Layer)
5. Inline AI task detection and highlighting

This builds on top of Phase 2b. It requires the editor to be functional first.

Recommended order: 2a → 2b → 2c

---

## Risks and Mitigations

- **BlockNote API stability:** v0.47.3 APIs may change. Mitigation: pin version, use documented APIs only (no private `_tiptapEditor` access in Phase 2b, only needed for 2c if going the ProseMirror plugin route).
- **Editor performance with AI detection:** Sending content to parse-task on every pause could feel laggy. Mitigation: only analyze the last-changed paragraph, not full document. 1200ms debounce.
- **Capture document bloat:** If users write a lot in Inbox without cleaning up, the document grows. Mitigation: no limit for now, but consider adding a "Clear" button or auto-archiving old content in future.
- **Mobile/desktop state sync:** CaptureInput (mobile) and InboxEditor (desktop) are different components. Mitigation: Phase 2b's capture document is the source of truth. Mobile CaptureInput continues to create tasks directly (no document). The two experiences are intentionally different.
- **Notes API filter regression:** Adding `type` filter to notes GET could break existing queries. Mitigation: filter only in the notes listing endpoint, not in note-by-id fetch.

## Mockups

Desktop Inbox editor mockup from Phase 1 brainstorming is at `.superpowers/brainstorm/` — `desktop-polished.html` shows the target design with the editor area, AI suggestion bar, and captured tasks section.
