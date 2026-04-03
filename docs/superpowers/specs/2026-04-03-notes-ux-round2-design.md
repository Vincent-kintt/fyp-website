# Notes UX Round 2 — Design Spec

## Goal

Close remaining UX gaps between our Notes page and Notion: collapsible/resizable sidebar, page icon picker (Lucide SVG), empty states with onboarding hints, and title/editor alignment fix.

## Scope

4 features, no new npm dependencies.

---

## 1. Sidebar Collapse & Resize

### Collapse Toggle

- A `ChevronsLeft` (lucide) button at the top-right of the sidebar header.
- Click to collapse. Sidebar width transitions to 0 with a 200ms ease-out CSS transition.
- When collapsed, a `PanelLeft` button appears fixed at the top-left of the editor area (inside `NotesLayout`, not the top bar).
- Click `PanelLeft` to expand back.
- State persisted in `localStorage` key `notes-sidebar-collapsed`. Default: expanded on desktop, collapsed on mobile (md breakpoint).

### Hover Peek (collapsed state only)

- When sidebar is collapsed, a 12px invisible trigger zone on the left edge of the viewport.
- Hovering the trigger zone for 200ms shows the sidebar as a floating overlay:
  - `position: fixed; left: 0; top: 4rem; bottom: 0; width: <saved width>px; z-index: 40`
  - Semi-transparent backdrop (same as MobileSidebar)
  - Box shadow: `4px 0 16px rgba(0,0,0,0.2)`
- Moving mouse out of the overlay starts a 300ms delay before hiding.
- Clicking a note in peek mode navigates AND closes the peek.
- The peek overlay reuses the existing `PageTree` component (same as MobileSidebar does).

### Drag Resize

- A 4px invisible handle on the right edge of the sidebar (`cursor: col-resize`).
- On hover, handle shows a 2px visible line (subtle, `var(--border)` color).
- Drag to resize. Constraints: min 200px, max 480px.
- Width persisted in `localStorage` key `notes-sidebar-width`. Default: 240px.
- Double-click handle resets to 240px.
- During drag, `user-select: none` on `document.body` to prevent text selection.

### Files affected

- `components/notes/NotesLayout.js` — collapse state, toggle buttons, peek overlay, resize handle
- `app/globals.css` — sidebar transition, resize handle styles, peek overlay styles

---

## 2. Page Icon Picker

### Data Model

- Add `icon` field to notes in MongoDB: `{ name: String, color: String }` or `null`.
- `name`: lucide icon name (e.g. `"file-text"`, `"lightbulb"`, `"calendar"`).
- `color`: one of `"gray"`, `"red"`, `"amber"`, `"green"`, `"blue"`, `"purple"`, `"pink"`.
- Default: `null` → renders current File/Folder/FolderOpen icons (no behavior change for existing notes).
- Saved via existing PATCH `/api/notes/[noteId]` endpoint (add `icon` to accepted fields).

### Color Map

```
gray   → #9ca3af (light) / #9ca3af (dark)
red    → #ef4444 / #f87171
amber  → #d97706 / #fbbf24
green  → #16a34a / #4ade80
blue   → #2563eb / #60a5fa
purple → #7c3aed / #a78bfa
pink   → #db2777 / #f472b6
```

### Icon Set (~60 curated icons)

Three categories:

**Documents** (~20): `file`, `file-text`, `file-check`, `file-code`, `file-spreadsheet`, `book`, `book-open`, `notebook`, `clipboard`, `clipboard-list`, `scroll`, `newspaper`, `sticky-note`, `pen-line`, `pen-tool`, `highlighter`, `type`, `text`, `align-left`, `list`

**Work** (~20): `check-circle`, `circle-dot`, `calendar`, `clock`, `timer`, `briefcase`, `target`, `flag`, `bookmark`, `tag`, `inbox`, `mail`, `send`, `phone`, `video`, `users`, `user`, `building`, `map-pin`, `globe`

**General** (~20): `home`, `grid`, `layout-grid`, `settings`, `lock`, `unlock`, `link`, `paperclip`, `cloud`, `bell`, `search`, `zap`, `lightbulb`, `star`, `heart`, `shield`, `key`, `database`, `server`, `code`

### Picker Component (`components/notes/IconPicker.js`)

- Popup positioned below the trigger element (icon area in editor title, or context menu in sidebar).
- Search bar at top: filters icons by name (simple `includes()` match).
- Color picker row: 7 color circles, selected one has outline ring.
- Icon grid: 8 columns, grouped by category with labels.
- "Remove icon" option at top of grid.
- Click icon → saves `{ name, color }` → closes picker.
- Click outside or Escape → closes without saving.
- Uses `useClickOutside` hook (already exists in the project).

### Where Icons Render

1. **Sidebar tree** (`PageTreeItem.js`): Replace File/Folder/FolderOpen with the custom icon when `note.icon` is set. Render at 15px with the icon's color.
2. **Breadcrumb** (`NoteTopBar.js`): Show icon before page name in breadcrumb, 14px.
3. **Editor title area** (`NoteEditor.js`): Show icon at 32px above the title input. Click to open picker. When no icon is set, show "Add icon" hint on hover (opacity 0.4, visible only on hover over the title area).

### Dynamic Lucide Rendering

Since lucide-react exports named components (`File`, `FileText`, etc.), we need a mapping from icon name strings to components. Create a `lib/notes/iconMap.js` that exports a `ICON_MAP` object mapping the ~60 curated icon names to their lucide-react components, plus a `getIconComponent(name)` helper.

---

## 3. Empty States

### New Page Placeholder

- "Add icon" button: appears above the title when `note.icon` is `null`, visible on hover only. Clicking opens the IconPicker.
- BlockNote placeholder: pass `placeholder` option to `useCreateBlockNote()` with the localized string "Enter text or type '/' for commands". BlockNote natively supports this.

### Empty Sidebar

- When `notes.length === 0` in PageTree, render centered empty state:
  - File icon (lucide) at 32px, opacity 0.15
  - "No pages yet" text, opacity 0.35
  - "New page" button (same style as existing "+ New Page" button)

### No Note Selected

- `app/[locale]/(app)/notes/page.js` already exists with an empty state (FileText icon + create button). No changes needed — current implementation is sufficient.

### Files affected

- `components/notes/NoteEditor.js` — "Add icon" hover hint, BlockNote placeholder
- `components/notes/PageTree.js` — empty sidebar state

---

## 4. Title/Editor Alignment Fix

- BlockNote `.bn-editor` has `padding-inline: 54px` (hardcoded in `@blocknote/core`).
- The title input currently has `padding: 0`, causing a 54px horizontal misalignment.
- Fix: add `padding-left: 54px` to `.notes-title-input` in `globals.css`.
- Also apply the same 54px left padding to the "Add icon" hover hint so it aligns with the title and editor text.

### Files affected

- `app/globals.css` — `.notes-title-input` padding

---

## i18n

New translation keys needed under `"notes"` namespace:

| Key | en | zh-TW |
|-----|-----|-------|
| `addIcon` | `"Add icon"` | `"新增圖示"` |
| `searchIcons` | `"Search icons..."` | `"搜尋圖示..."` |
| `removeIcon` | `"Remove icon"` | `"移除圖示"` |
| `documents` | `"Documents"` | `"文件"` |
| `work` | `"Work"` | `"工作"` |
| `general` | `"General"` | `"一般"` |
| `noPages` | `"No pages yet"` | `"還沒有頁面"` |
| `editorPlaceholder` | `"Enter text or type '/' for commands"` | `"輸入文字或輸入 '/' 使用指令"` |
| `collapseSidebar` | `"Collapse sidebar"` | `"收合側邊欄"` |
| `expandSidebar` | `"Expand sidebar"` | `"展開側邊欄"` |

---

## Out of Scope

- Emoji support (decided: Lucide SVG only)
- Keyboard shortcuts (deferred to future round)
- Page transitions/animations (deferred)
- Cover images
- Share / Favorites
