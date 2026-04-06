# Notes UX Improvements: Dialogs, Note Linking, Search

Three independent improvements to the notes system, shipped together.

## Feature 1: Replace Native Dialogs

### Problem

Three places in notes code use `window.prompt()` / `window.confirm()`:
- `hooks/useNotes.js:71` — `confirm()` before soft-deleting a note
- `components/notes/TrashSection.js:45` — `confirm()` before permanent delete
- `app/[locale]/(notes)/notes/[noteId]/page.js:162` — `prompt()` for rename

These look jarring — native browser dialogs with no styling, inconsistent with the rest of the UI.

### Solution

Create two reusable components in `components/ui/`:

**`ConfirmDialog.js`** — modal with title, message, cancel + confirm buttons.

Props:
- `open` (boolean) — controls visibility
- `onClose` () — called on cancel, backdrop click, or Escape
- `onConfirm` () — called on confirm button click
- `title` (string) — dialog title
- `message` (string) — body text
- `confirmLabel` (string, optional) — defaults to common.delete or common.confirm
- `cancelLabel` (string, optional) — defaults to common.cancel
- `variant` ("default" | "danger") — danger turns confirm button red

**`PromptDialog.js`** — same shell, plus an input field.

Props: same as ConfirmDialog, plus:
- `defaultValue` (string) — pre-fills the input
- `onSubmit` (value: string) — called with trimmed input on confirm
- `inputLabel` (string, optional)
- `placeholder` (string, optional)

Both follow the existing `EditReminderModal` pattern:
- `createPortal` to document.body
- Backdrop with `modal-backdrop-enter/exit` animation classes
- Panel with `modal-panel-enter/exit`
- Escape key closes
- Auto-focus on confirm button (ConfirmDialog) or input field (PromptDialog)
- Body scroll lock while open

### Replacement Plan

1. **`useNotes.js` deleteNote** — remove the `confirm()` call from the hook. The hook becomes a pure API caller. Callers (`PageTreeItem` context menu, `NoteTopBar` delete, `page.js` handleDeleteNote) each manage their own `<ConfirmDialog>` state.

2. **`TrashSection.js` permanent delete** — add `<ConfirmDialog variant="danger">` state inside TrashSection. The `confirm()` inline in onClick becomes `setDeleteTarget(note.id)` which opens the dialog.

3. **`page.js` rename** — add `<PromptDialog>` state. The `prompt()` call becomes `setShowRenameDialog(true)`, and `onSubmit` calls `renameNote()`.

### i18n Keys (notes namespace)

- `confirmDeleteTitle` — "Delete Page" / "刪除頁面"
- `confirmPermanentDeleteTitle` — "Delete Permanently" / "永久刪除"
- `renameTitle` — "Rename Page" / "重新命名頁面"

Existing keys reused: `confirmDelete`, `confirmPermanentDelete`, `rename`, `common.cancel`, `common.delete`.

---

## Feature 2: @mention Note Linking

### Problem

No way to reference other notes from within the editor. Users can't build connections between notes.

### Solution

Use BlockNote's built-in extension points:

**Custom inline content type: `noteLink`**

File: `components/notes/NoteLinkInlineContent.js`

```
createReactInlineContentSpec({
  type: "noteLink",
  propSchema: { noteId: { default: "" } },
  content: "none",  // atomic chip, not editable
})
```

The render component:
- Receives `inlineContent.props.noteId`
- Looks up the note title from React Query cache (`queryClient.getQueryData(noteKeys.lists())`) — notes are already cached by `useNotes`
- Renders a small chip: `[icon] Note Title` with subtle background, rounded corners
- If note not found in cache (deleted or not loaded), shows "Deleted note" in muted style
- `onClick` → `router.push(/notes/${noteId})`
- Hover: underline + pointer cursor
- IMPORTANT: use `useRouter` from `@/i18n/navigation`, not `next/navigation`

**Accessing notes list inside the chip component:**

The chip is a React component rendered by BlockNote. It can use hooks. Use `useQueryClient` from TanStack Query to read the cached notes list. No extra API call needed — notes are already in cache from the sidebar's `useNotes()`.

```js
function NoteLinkChip({ noteId }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const notes = queryClient.getQueryData(noteKeys.lists()) || [];
  const note = notes.find(n => n.id === noteId);
  // render chip...
}
```

**Editor schema registration:**

In `NoteEditor.js`, pass a custom schema to `useCreateBlockNote`:
```js
const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    noteLink: noteLinkSpec,
  },
});

const editor = useCreateBlockNote({
  schema,
  initialContent: ...,
  dictionary: ...,
});
```

**@ suggestion menu:**

Add a second `<SuggestionMenuController>` in NoteEditor:
```jsx
<SuggestionMenuController
  triggerCharacter="@"
  getItems={async (query) =>
    filterSuggestionItems(noteItems, query)
  }
/>
```

Where `noteItems` is derived from the notes list (passed as prop or from context). Each item:
- `title`: note title
- `onItemClick`: `editor.insertInlineContent([{ type: "noteLink", props: { noteId } }])`
- `icon`: note icon or default File icon
- `aliases`: [] (no aliases needed)
- `group`: "Notes"

Filtering: `filterSuggestionItems` (already imported from `@blocknote/core`) does substring matching on title.

**Notes list access in NoteEditor:**

NoteEditor currently doesn't receive the notes list. Two options:
- A: Pass `notes` as a prop from `page.js` (which already has them from `useNotes`)
- B: Call `useNotes()` inside NoteEditor

Go with **A** — prop drilling is explicit and NoteEditor shouldn't own data fetching. `page.js` already has `notes` from `useNotes()`, just pass it down. The Inbox page passes `disableAiCommands` which also disables the @ menu, so no issue there.

**blocksToText update:**

In `lib/notes/blocksToText.js`, handle `noteLink` inline content type:
```js
if (inline.type === "noteLink") {
  return `[Note: ${inline.props?.noteId || "unknown"}]`;
}
```

This ensures AI tools can see that a note reference exists, even though they can't resolve the title server-side (they'd need to use `readNote` tool for that).

### i18n Keys

- `noteLinkDeleted` — "Deleted note" / "已刪除的筆記"
- `mentionNotes` — "Notes" (group heading in @ menu) / "筆記"

---

## Feature 3: Notes Search

### Problem

No way to search notes. GlobalSearch (Cmd+K) only searches reminders. Notes sidebar has no filter.

### Solution: Two search surfaces

**A. GlobalSearch integration**

In `components/search/GlobalSearch.js`:
- On open, fetch notes alongside reminders: `GET /api/notes` (same endpoint, already cached by React Query but GlobalSearch uses its own fetch + cache)
- Add a "Notes" `Command.Group` section between Quick Actions and Reminders
- Each note item: `[icon] title` with `editedAgo` timestamp
- `value` prop: note title (cmdk does substring matching)
- `onSelect`: `router.push(/notes/${note.id})`
- Show up to 5 notes when browsing, all when searching
- Reuse the existing `HighlightText` component for search term highlighting
- Use the same 30s cache as reminders (`cacheRef` pattern)

Notes icon: use a simple document SVG (like the existing `SearchIcon`, `PlusIcon` pattern) or import `File` from lucide-react. GlobalSearch currently uses inline SVGs — follow that pattern for consistency.

**B. Sidebar filter in PageTree**

In `components/notes/PageTree.js`:
- Add a search input at the top, between the header and the tree
- Small, subtle input with search icon (matches sidebar aesthetic)
- When query is non-empty: switch from tree view to flat filtered list
  - Filter `notes` by `title.toLowerCase().includes(query.toLowerCase())`
  - Render as simple list items (no indentation, no drag-and-drop)
  - Each item: click navigates to `/notes/${id}`
  - Show "No results" if nothing matches
- When query is empty: show normal tree view (current behavior, unchanged)
- Escape key clears the filter and returns to tree view
- The search input should NOT trigger on Cmd+K (that's for GlobalSearch)

### i18n Keys

- `search.notes` — "Notes" (group heading in GlobalSearch) / "筆記"
- `notes.filterPlaceholder` — "Filter pages..." / "篩選頁面..."
- `notes.noFilterResults` — "No matching pages" / "找不到符合的頁面"

---

## Non-Goals

- Full-text content search (title-only for now)
- Note backlinks panel (showing which notes link to current note)
- Hover preview for note-link chips
- Real-time title sync for noteLink chips (read from cache, stale until refetch)
- Replacing native dialogs in reminders code (only notes scope)

## Testing

- Unit tests for ConfirmDialog and PromptDialog (open/close, Escape, confirm callback, input handling)
- Unit tests for noteLink inline content (render, click navigation, deleted note fallback)
- Integration test for blocksToText with noteLink content
- E2E: verify native dialogs are gone, @ menu appears and inserts chip, GlobalSearch shows notes, sidebar filter works
