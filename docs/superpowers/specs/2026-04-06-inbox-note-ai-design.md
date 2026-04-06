# Inbox Redesign: Note-Based + AI Task Extraction

## Summary

Replace the current structured InboxInput + InboxTaskRow inbox with a BlockNote editor-based inbox. The inbox page reuses the same NoteEditor component as the Notes system, but adds an AI layer that extracts tasks from free-form text and creates reminders. Users write freely (brainstorm, plan, dump ideas), then click "Extract Tasks" to let AI parse the content into structured task cards.

## Design Decisions (with rationale)

- **Inbox = BlockNote editor** — same component as Notes, zero new editor UI to build. Users already know how to use it.
- **AI extraction is manual** (button click) — not real-time. Controls token cost, avoids noisy partial results, matches user mental model of "write first, process later" (GTD pattern).
- **Source text is never modified** — industry standard (Notion AI, Apple Intelligence, Otter.ai, Drafts). Extraction creates parallel artifacts.
- **Confirmed cards disappear** — task enters reminder system, card removed from extracted section. Clean separation.
- **Content lifecycle is user-controlled** — no auto-clear, no auto-archive. Inbox is a persistent note the user manages like any other note.
- **InboxInput (quick capture textarea) is removed** — the editor IS the capture surface.
- **Each implementation step gets its own commit** — for easy rollback.

---

## Part 1: Data Model

### Inbox document in notes collection

The inbox is stored as a single document in the `notes` collection with `type: "inbox"`.

```javascript
{
  userId: ObjectId,
  type: "inbox",          // distinguishes from regular notes
  title: "Inbox",         // fixed, not user-editable
  content: [...],         // BlockNote JSON content
  createdAt: Date,
  updatedAt: Date,
}
```

- Created automatically on first visit to /inbox if no `type: "inbox"` document exists for the user.
- Excluded from notes tree sidebar (filter `type: { $ne: "inbox" }` in GET /api/notes).
- Excluded from notes trash flow.
- One per user, enforced by unique partial index `{ userId: 1, type: 1 }` where `type: "inbox"` + `findOneAndUpdate` with upsert. This prevents race conditions from concurrent first visits.

### MongoDB index

Create unique partial index before any other step:

```javascript
db.notes.createIndex(
  { userId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "inbox" } }
);
```

Script: `scripts/create-inbox-note-index.js`

### Reminder creation: dateTime-aware inboxState

Current API validation (`app/api/reminders/route.js:144`) rejects non-inbox tasks without `dateTime`. Extracted tasks may or may not have dates. The confirm flow must set `inboxState` based on whether AI found a date:

- Extracted task WITH dateTime → `inboxState: "processed"` (appears in dashboard/calendar)
- Extracted task WITHOUT dateTime → `inboxState: "inbox"` (stays in unprocessed queue, user triages later via TaskDetailPanel or dashboard)

This matches the existing data model semantics and avoids API validation changes.

### Existing inbox tasks migration

Tasks created with the old InboxInput (`inboxState: "inbox"`) still exist in the DB. After the rewrite, the new inbox page no longer displays them. These tasks are still queryable via `GET /api/reminders?inboxState=inbox` and visible through the AI modal. No migration needed — they naturally age out. If any remain after a reasonable period, a future cleanup script can batch-update them to `inboxState: "processed"`.

---

## Part 2: API

### GET /api/notes — exclude inbox document

Add `type: { $ne: "inbox" }` to the query filter. This prevents the inbox document from appearing in the notes sidebar tree.

### GET /api/notes/trash — exclude inbox document

Same filter. Inbox document cannot be trashed.

### GET/PATCH/DELETE /api/notes/[noteId] — guard inbox document

Add guard: if the fetched note has `type: "inbox"`, reject PATCH (title/type changes) and DELETE requests with 403. GET is allowed (needed by inbox page). This prevents the inbox document from being renamed, reparented, or deleted via generic note routes.

### POST /api/notes/reorder — guard inbox document

Skip any reorder entry whose `noteId` matches the inbox document. Inbox should not appear in the notes tree ordering.

### POST /api/inbox/note (new)

Get-or-create the inbox note for the current user.

```javascript
// Request: GET-like, no body needed (POST because it may create)
// Response: { success: true, data: { id, content, updatedAt } }
```

Implementation: `findOneAndUpdate({ userId, type: "inbox" }, { $setOnInsert: { title: "Inbox", content: [], createdAt: new Date() } }, { upsert: true, returnDocument: "after" })`

### PATCH /api/inbox/note (new)

Save inbox content. Same contract as `PATCH /api/notes/[noteId]` but scoped to the user's inbox document.

```javascript
// Request: { content: [...BlockNote JSON] }
// Response: { success: true }
```

Validation: only accepts `content` field. Does not allow changing `title` or `type`.

### POST /api/ai/extract-tasks (new)

Extract tasks from free-form text using AI.

```javascript
// Request: { text: string, language: "en" | "zh" }
// Response: {
//   success: true,
//   data: {
//     tasks: [
//       {
//         title: string,
//         dateTime: string | null,   // ISO format or null
//         priority: "high" | "medium" | "low",
//         tags: string[],
//       }
//     ]
//   }
// }
```

Implementation:
- Uses `generateText` from AI SDK with `getModel()` provider (same as parse-task).
- System prompt instructs AI to: identify actionable items, extract date/time (relative to current date), infer priority, suggest tags.
- Input is plain text extracted from BlockNote content (not the JSON blocks).
- Returns structured JSON array of tasks.
- Non-actionable text (observations, notes, context) is ignored by the AI.
- Input size limit: truncate to 8000 chars (roughly 2000 tokens). If content exceeds this, truncate with a warning in the response. The existing parse-task caps at 2000 chars, but inbox content will be longer.
- Auth: must call `auth()` directly (middleware does not cover /api routes). Return 401 if no session.
- Validate response with Zod schema to ensure structured output.

### Existing endpoints — no changes

- `POST /api/reminders` — used by confirm flow to create reminders. No changes needed.
- `PATCH /api/reminders/[id]` — unchanged.
- `GET /api/reminders?inboxState=inbox` — still works for any future use, but not used by the new inbox page.

---

## Part 3: Inbox Page

### `app/[locale]/(app)/inbox/page.js` — rewrite

```
Layout:
├── InboxTopBar (custom, simpler than NoteTopBar)
│   ├── Inbox icon (Lucide: Inbox)
│   ├── "Inbox" label
│   ├── Save status indicator
│   ├── "Extract Tasks" button (primary style)
│   └── Menu (kebab) — future: clear content, settings
├── NoteEditor (reused from notes system)
│   ├── Title input (hidden or fixed to "Inbox")
│   └── BlockNote editor
└── ExtractedTasksSection (conditional, only after extraction)
    ├── Header: "Extracted Tasks" + "Confirm All" button
    └── ExtractedTaskCard list
```

State management:
- `inboxNote` — fetched from `POST /api/inbox/note` on mount
- `extractedTasks` — array of AI-extracted tasks, initially empty
- `isExtracting` — loading state for AI extraction
- `confirmedIds` — Set of task indices that have been confirmed

### Loading flow

1. Page mounts → `POST /api/inbox/note` to get-or-create inbox document
2. Pass `inboxNote` to NoteEditor as the `note` prop
3. NoteEditor handles auto-save (same as notes page)

### Extract flow

1. User clicks "Extract Tasks"
2. Flush pending editor save (call `editorRef.current?.getContent()` — see Part 5 for NoteEditor changes)
3. Convert BlockNote blocks to plain text via a dedicated `blocksToText()` utility (NOT `lib/notes/preview.js` which truncates to 80 chars)
4. POST to `/api/ai/extract-tasks` with the text + locale
5. Set `extractedTasks` state with the response
6. Render ExtractedTasksSection below editor
7. If re-extracting (extractedTasks already has items), replace the list entirely. User is responsible for confirming before re-extracting. Show a brief warning toast if there are unconfirmed tasks.

### Confirm flow

1. User clicks confirm (checkmark) on a task card
2. POST to `/api/reminders` with task data. Set `inboxState` based on dateTime:
   - Has dateTime → `inboxState: "processed"`
   - No dateTime → `inboxState: "inbox"`
3. On success: remove card from `extractedTasks` array, show success toast
4. On failure: keep card, show error toast (do NOT remove)
5. Invalidate reminder query cache (`reminderKeys.all`)

### Confirm All flow

1. POST each task to `/api/reminders` sequentially
2. Track successes and failures independently
3. Remove only successfully created tasks from the list
4. If any fail, show error toast with count: "3 created, 1 failed"
5. Invalidate reminder query cache

---

## Part 4: Components

### `components/inbox/InboxTopBar.js` (new)

Simpler than NoteTopBar. No breadcrumbs (inbox has no parent). No rename/duplicate.

Props: `saveStatus`, `onExtract`, `isExtracting`

Elements:
- Lucide `Inbox` icon (14px, stroke 1.5)
- "Inbox" text label (12px, font-weight 500, text-muted color)
- Save status text (11px, text-muted)
- "Extract Tasks" button: primary color, 11px, with Lucide `Download` icon (12px). Disabled + spinner during extraction.
- Kebab menu (MoreHorizontal icon): placeholder for future actions

Styling: matches `.notes-topbar` CSS class exactly (min-height 40px, border-bottom, padding 0 12px).

### `components/inbox/ExtractedTaskCard.js` (new)

Single extracted task card.

Props: `task`, `onConfirm`, `onDismiss`

Elements:
- Priority-colored circle (18px, border-only, same as existing InboxTaskRow)
- Title (13px, text-primary)
- Metadata row: date chip (text, primary color), tag chips (text, text-muted), priority text (colored by level)
- Confirm button: Lucide `Check` icon (14px), text-muted, hover: text-success
- Dismiss button: Lucide `X` icon (14px), text-muted, hover: text-danger

Styling: background surface, border-radius 8px, padding 8px 10px. Same visual language as existing task rows.

### `components/inbox/ExtractedTasksSection.js` (new)

Container for extracted task cards.

Props: `tasks`, `onConfirm`, `onConfirmAll`, `onDismiss`

Elements:
- Section header: "EXTRACTED TASKS" label (11px, uppercase, text-muted, letter-spacing 0.5px)
- "Confirm All" button (10px, border style, text-secondary)
- List of ExtractedTaskCard

Styling: padding 12px 16px, border-top 1px solid var(--border) to separate from editor.

---

## Part 5: NoteEditor Reuse

The existing `components/notes/NoteEditor.js` is reused as-is for the inbox. Specific considerations:

- **Title**: The inbox title is fixed to "Inbox". Two options:
  - (a) Hide the title input entirely (set display: none via a prop)
  - (b) Show it but make it read-only
  - Recommendation: (a) — hide it. The TopBar already shows "Inbox". Cleaner.
  - Implementation: add an optional `hideTitle` prop to NoteEditor. When true, skip rendering the title input and icon picker.

- **Content access for extraction**: NoteEditor currently only exposes debounced saves via `onSave`. The inbox page needs to read the current editor content on demand (when user clicks Extract). Add:
  - `editorRef` prop (or `onEditorReady` callback) that exposes `{ getContent(): BlockNoteBlock[] }` to the parent
  - This lets the inbox page call `editorRef.current.getContent()` to get the latest blocks without waiting for debounce
  - Implementation: store the BlockNote editor instance in a ref inside NoteEditor, expose it via `useImperativeHandle` or a callback

- **Auto-save**: Same mechanism as notes. NoteEditor calls `onSave({ content })` on debounced changes. Inbox page's `onSave` calls `PATCH /api/inbox/note`.

- **Icon picker**: Hidden when `hideTitle` is true.

- **Slash commands**: Reuse the same slash commands as notes. No inbox-specific commands needed.

- **AI slash commands**: NoteEditor renders some AI-related slash commands. These are fine to keep — they don't conflict with inbox functionality.

---

## Part 6: Files Affected

### Create
- `scripts/create-inbox-note-index.js` — unique partial index for inbox document
- `app/api/inbox/note/route.js` — GET-or-create + PATCH inbox note
- `app/api/ai/extract-tasks/route.js` — AI task extraction endpoint
- `lib/notes/blocksToText.js` — BlockNote blocks to plain text converter (not truncated)
- `components/inbox/InboxTopBar.js` — simplified top bar
- `components/inbox/ExtractedTaskCard.js` — single task card
- `components/inbox/ExtractedTasksSection.js` — card list container

### Modify
- `app/[locale]/(app)/inbox/page.js` — full rewrite
- `components/notes/NoteEditor.js` — add `hideTitle` prop + `editorRef`/content access
- `app/api/notes/route.js` — add `type: { $ne: "inbox" }` filter
- `app/api/notes/trash/route.js` — add `type: { $ne: "inbox" }` filter
- `app/api/notes/[noteId]/route.js` — guard inbox document against PATCH(title/type)/DELETE
- `app/api/notes/reorder/route.js` — skip inbox document in reorder
- `messages/en.json` — new inbox i18n keys
- `messages/zh-TW.json` — new inbox i18n keys

### Delete
- `components/inbox/InboxInput.js`
- `components/inbox/InboxTaskRow.js`
- `hooks/useInboxTasks.js`

### Keep (no changes)
- `lib/queryKeys.js` — reminderKeys still used for cache invalidation
- `app/api/reminders/route.js` — POST endpoint used by confirm flow
- NoteEditor component — reused, only adding one optional prop

---

## Part 7: i18n Keys

### Add to `inbox` namespace
```
inbox.extractTasks — "Extract Tasks" / "提取任務"
inbox.extracting — "Extracting..." / "提取中..."
inbox.extractedTasks — "Extracted Tasks" / "已提取的任務"
inbox.confirmAll — "Confirm All" / "全部確認"
inbox.noTasks — "No tasks found in your writing." / "未在內容中找到任務。"
inbox.confirmed — "Task created" / "任務已建立"
inbox.dismissed — "Dismissed" / "已忽略"
```

### Remove (no longer used)
```
inbox.newTodo
inbox.parsing
inbox.addFailed
inbox.unprocessed
inbox.inboxZero
inbox.inboxZeroDesc
```

---

## Part 8: Implementation Order

Each step is a separate commit for easy rollback.

1. **DB: inbox note index** — create unique partial index script, run it
2. **i18n: add new translation keys** — add all new inbox keys first (components need them). Keep old keys until step 9.
3. **API: inbox note endpoints** — POST/PATCH /api/inbox/note, exclude inbox from notes queries, guard generic note routes
4. **Util: blocksToText** — BlockNote blocks to plain text converter
5. **API: extract-tasks endpoint** — POST /api/ai/extract-tasks with AI integration + auth + Zod validation
6. **NoteEditor: hideTitle + editorRef** — add props to existing component (backward compatible)
7. **Component: InboxTopBar** — simplified top bar with Extract button
8. **Component: ExtractedTaskCard + ExtractedTasksSection** — task card UI
9. **Page: inbox rewrite** — wire everything together, replace old implementation
10. **Cleanup: delete old components** — InboxInput, InboxTaskRow, useInboxTasks, remove unused i18n keys

---

## Risks and Mitigations

- **BlockNote text extraction**: Need a dedicated `blocksToText()` utility. Do NOT use `lib/notes/preview.js` (truncates to 80 chars). Walk the block tree recursively, concatenating text content. Verify output quality with nested blocks, lists, and headings.
- **AI extraction quality**: The AI may miss tasks or hallucinate metadata. Mitigated by: user reviews every card before confirming, dismiss button for incorrect items, "Confirm All" is optional.
- **Inbox note orphaning**: If the notes collection gets cleared or migrated, the inbox document could be lost. Mitigated by: get-or-create pattern (auto-recreates on next visit).
- **NoteEditor prop compatibility**: Adding `hideTitle` and `editorRef` must not break existing notes pages. Mitigated by: both props default to false/null, only inbox passes them. Verify notes page still works after the change.
- **Existing inbox tasks**: Tasks created with the old InboxInput (`inboxState: "inbox"`) still exist in the DB. The new inbox page does not display them. They remain queryable via `GET /api/reminders?inboxState=inbox` and visible through the AI modal. No migration needed — they naturally age out.
- **Duplicate extraction**: Re-extracting from the same text creates duplicate task cards (not duplicate reminders — reminders are only created on confirm). Mitigated by: replacing the extracted list on re-extract + warning toast if unconfirmed tasks exist.
- **Race condition on inbox creation**: Mitigated by unique partial index on `{ userId: 1, type: 1 }` where `type: "inbox"`. Concurrent upserts will hit the unique constraint; one succeeds, the other retries the find.
- **Auth on new API routes**: Middleware does not cover `/api/*` routes. Both `/api/inbox/note` and `/api/ai/extract-tasks` must call `auth()` directly and return 401 if no session.
- **Confirm All partial failure**: Individual task creation may fail (network, validation). Confirm All tracks successes/failures independently, only removes confirmed cards, shows error count.
