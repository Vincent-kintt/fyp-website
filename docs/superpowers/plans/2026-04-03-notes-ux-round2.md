# Notes UX Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close remaining UX gaps with Notion: collapsible/resizable sidebar, Lucide SVG page icon picker with color, empty states with onboarding hints, and title/editor horizontal alignment fix.

**Architecture:** All 4 features are UI-only changes with zero new npm dependencies. Icon data stored in existing MongoDB `notes` collection (`icon` field already accepted by PATCH endpoint). Sidebar state persisted in localStorage. Icon rendering via a static map from kebab-case names to lucide-react components.

**Tech Stack:** Next.js 15, React, lucide-react, next-intl, CSS custom properties, localStorage

---

### Task 1: i18n Keys + Title Alignment Fix

**Files:**
- Modify: `messages/en.json:272-308` (notes namespace)
- Modify: `messages/zh-TW.json` (notes namespace)
- Modify: `app/globals.css:1016-1028` (`.notes-title-input`)

- [ ] **Step 1: Add i18n keys to en.json**

Add these keys inside the `"notes"` object (after `"saved": "Saved"` on line 307):

```json
"addIcon": "Add icon",
"searchIcons": "Search icons...",
"removeIcon": "Remove icon",
"iconDocuments": "Documents",
"iconWork": "Work",
"iconGeneral": "General",
"noPages": "No pages yet",
"editorPlaceholder": "Enter text or type '/' for commands",
"collapseSidebar": "Collapse sidebar",
"expandSidebar": "Expand sidebar"
```

- [ ] **Step 2: Add i18n keys to zh-TW.json**

Same keys, Traditional Chinese values:

```json
"addIcon": "新增圖示",
"searchIcons": "搜尋圖示...",
"removeIcon": "移除圖示",
"iconDocuments": "文件",
"iconWork": "工作",
"iconGeneral": "一般",
"noPages": "還沒有頁面",
"editorPlaceholder": "輸入文字或輸入 '/' 使用指令",
"collapseSidebar": "收合側邊欄",
"expandSidebar": "展開側邊欄"
```

- [ ] **Step 3: Fix title/editor alignment**

In `app/globals.css`, change `.notes-title-input` padding from `0` to `54px` left (matches BlockNote's hardcoded `padding-inline: 54px` in `@blocknote/core`):

```css
.notes-title-input {
  font-size: 40px;
  font-weight: 700;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  padding: 0 54px;
  line-height: 1.2;
  letter-spacing: -0.02em;
  caret-color: var(--text-primary);
}
```

- [ ] **Step 4: Verify alignment**

Run: `npm run dev`

Open a notes page. The title text and editor body text should start at the same horizontal position. Check both desktop and mobile.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/zh-TW.json app/globals.css
git commit -m "feat(notes): add i18n keys and fix title/editor alignment"
```

---

### Task 2: Icon Map + NoteIcon Renderer

**Files:**
- Create: `lib/notes/iconMap.js`
- Create: `components/notes/NoteIcon.js`

- [ ] **Step 1: Create icon map**

Create `lib/notes/iconMap.js` with ~60 curated icons mapped from kebab-case names to lucide-react components, a color map, and a helper function:

```js
import {
  File, FileText, FileCheck, FileCode, FileSpreadsheet,
  Book, BookOpen, Notebook, Clipboard, ClipboardList,
  Scroll, Newspaper, StickyNote, PenLine, PenTool,
  Highlighter, Type, AlignLeft, List, ListChecks,
  CheckCircle, CircleDot, Calendar, Clock, Timer,
  Briefcase, Target, Flag, Bookmark, Tag,
  Inbox, Mail, Send, Phone, Video,
  Users, User, Building, MapPin, Globe,
  Home, Grid3x3, LayoutGrid, Settings, Lock,
  Unlock, Link, Paperclip, Cloud, Bell,
  Search, Zap, Lightbulb, Star, Heart,
  Shield, Key, Database, Server, Code,
} from "lucide-react";

export const ICON_CATEGORIES = {
  documents: [
    "file", "file-text", "file-check", "file-code", "file-spreadsheet",
    "book", "book-open", "notebook", "clipboard", "clipboard-list",
    "scroll", "newspaper", "sticky-note", "pen-line", "pen-tool",
    "highlighter", "type", "align-left", "list", "list-checks",
  ],
  work: [
    "check-circle", "circle-dot", "calendar", "clock", "timer",
    "briefcase", "target", "flag", "bookmark", "tag",
    "inbox", "mail", "send", "phone", "video",
    "users", "user", "building", "map-pin", "globe",
  ],
  general: [
    "home", "grid-3x3", "layout-grid", "settings", "lock",
    "unlock", "link", "paperclip", "cloud", "bell",
    "search", "zap", "lightbulb", "star", "heart",
    "shield", "key", "database", "server", "code",
  ],
};

export const ICON_MAP = {
  "file": File,
  "file-text": FileText,
  "file-check": FileCheck,
  "file-code": FileCode,
  "file-spreadsheet": FileSpreadsheet,
  "book": Book,
  "book-open": BookOpen,
  "notebook": Notebook,
  "clipboard": Clipboard,
  "clipboard-list": ClipboardList,
  "scroll": Scroll,
  "newspaper": Newspaper,
  "sticky-note": StickyNote,
  "pen-line": PenLine,
  "pen-tool": PenTool,
  "highlighter": Highlighter,
  "type": Type,
  "align-left": AlignLeft,
  "list": List,
  "list-checks": ListChecks,
  "check-circle": CheckCircle,
  "circle-dot": CircleDot,
  "calendar": Calendar,
  "clock": Clock,
  "timer": Timer,
  "briefcase": Briefcase,
  "target": Target,
  "flag": Flag,
  "bookmark": Bookmark,
  "tag": Tag,
  "inbox": Inbox,
  "mail": Mail,
  "send": Send,
  "phone": Phone,
  "video": Video,
  "users": Users,
  "user": User,
  "building": Building,
  "map-pin": MapPin,
  "globe": Globe,
  "home": Home,
  "grid-3x3": Grid3x3,
  "layout-grid": LayoutGrid,
  "settings": Settings,
  "lock": Lock,
  "unlock": Unlock,
  "link": Link,
  "paperclip": Paperclip,
  "cloud": Cloud,
  "bell": Bell,
  "search": Search,
  "zap": Zap,
  "lightbulb": Lightbulb,
  "star": Star,
  "heart": Heart,
  "shield": Shield,
  "key": Key,
  "database": Database,
  "server": Server,
  "code": Code,
};

export const ICON_COLORS = {
  gray:   { light: "#9ca3af", dark: "#9ca3af" },
  red:    { light: "#ef4444", dark: "#f87171" },
  amber:  { light: "#d97706", dark: "#fbbf24" },
  green:  { light: "#16a34a", dark: "#4ade80" },
  blue:   { light: "#2563eb", dark: "#60a5fa" },
  purple: { light: "#7c3aed", dark: "#a78bfa" },
  pink:   { light: "#db2777", dark: "#f472b6" },
};

export const ICON_COLOR_NAMES = Object.keys(ICON_COLORS);

export function getIconComponent(name) {
  return ICON_MAP[name] || File;
}

export function getIconColor(colorName, theme) {
  const entry = ICON_COLORS[colorName];
  if (!entry) return ICON_COLORS.gray[theme === "dark" ? "dark" : "light"];
  return entry[theme === "dark" ? "dark" : "light"];
}

export const ALL_ICON_NAMES = Object.keys(ICON_MAP);
```

- [ ] **Step 2: Create NoteIcon renderer component**

Create `components/notes/NoteIcon.js` — a reusable component that renders a note's icon:

```jsx
"use client";

import { useTheme } from "next-themes";
import { File, Folder, FolderOpen } from "lucide-react";
import { getIconComponent, getIconColor } from "@/lib/notes/iconMap";

export default function NoteIcon({ icon, hasChildren, expanded, size = 15, fallbackOpacity = 0.6 }) {
  const { theme } = useTheme();

  if (icon?.name) {
    const IconComponent = getIconComponent(icon.name);
    const color = getIconColor(icon.color, theme);
    return <IconComponent size={size} strokeWidth={1.5} style={{ color, flexShrink: 0 }} />;
  }

  // Default icons based on note type
  const DefaultIcon = hasChildren ? (expanded ? FolderOpen : Folder) : File;
  return (
    <span className="flex-shrink-0" style={{ opacity: fallbackOpacity, color: "var(--text-muted)" }}>
      <DefaultIcon size={size} strokeWidth={1.5} />
    </span>
  );
}
```

- [ ] **Step 3: Write unit test for iconMap**

Create `tests/unit/notes-icon-map.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  getIconComponent,
  getIconColor,
  ICON_MAP,
  ICON_CATEGORIES,
  ALL_ICON_NAMES,
} from "@/lib/notes/iconMap";

describe("iconMap", () => {
  it("returns correct component for known icon", () => {
    const Component = getIconComponent("file-text");
    expect(Component).toBeDefined();
    expect(Component.displayName || Component.name).toBeTruthy();
  });

  it("returns File as fallback for unknown icon", () => {
    const Component = getIconComponent("nonexistent");
    const Fallback = getIconComponent("file");
    expect(Component).toBe(Fallback);
  });

  it("all category icons exist in ICON_MAP", () => {
    for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
      for (const name of icons) {
        expect(ICON_MAP[name], `${category}/${name} missing from ICON_MAP`).toBeDefined();
      }
    }
  });

  it("ALL_ICON_NAMES matches ICON_MAP keys", () => {
    expect(ALL_ICON_NAMES.length).toBe(Object.keys(ICON_MAP).length);
  });

  it("getIconColor returns hex string for all colors", () => {
    for (const theme of ["light", "dark"]) {
      for (const color of ["gray", "red", "amber", "green", "blue", "purple", "pink"]) {
        const hex = getIconColor(color, theme);
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("getIconColor falls back to gray for unknown color", () => {
    const result = getIconColor("nonexistent", "light");
    expect(result).toBe("#9ca3af");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- tests/unit/notes-icon-map.test.js`
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/notes/iconMap.js components/notes/NoteIcon.js tests/unit/notes-icon-map.test.js
git commit -m "feat(notes): add icon map utility and NoteIcon renderer"
```

---

### Task 3: IconPicker Component

**Files:**
- Create: `components/notes/IconPicker.js`
- Modify: `app/globals.css` (add `.notes-icon-picker` styles)

- [ ] **Step 1: Create IconPicker component**

Create `components/notes/IconPicker.js`:

```jsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Search, X } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  ICON_MAP,
  ICON_CATEGORIES,
  ICON_COLOR_NAMES,
  ICON_COLORS,
  getIconComponent,
  getIconColor,
} from "@/lib/notes/iconMap";

export default function IconPicker({ currentIcon, onSelect, onClose }) {
  const t = useTranslations("notes");
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [selectedColor, setSelectedColor] = useState(currentIcon?.color || "gray");
  const searchRef = useRef(null);
  const pickerRef = useClickOutside(() => onClose());

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filterIcons = (iconNames) => {
    if (!search.trim()) return iconNames;
    const q = search.toLowerCase();
    return iconNames.filter((name) => name.includes(q));
  };

  const handleSelectIcon = (name) => {
    onSelect({ name, color: selectedColor });
  };

  const handleRemove = () => {
    onSelect(null);
  };

  const colorHex = (colorName) =>
    getIconColor(colorName, theme);

  return (
    <div ref={pickerRef} className="notes-icon-picker">
      {/* Search */}
      <div className="notes-icon-picker-search">
        <Search size={13} strokeWidth={1.5} style={{ opacity: 0.4, flexShrink: 0 }} />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchIcons")}
        />
      </div>

      {/* Color picker */}
      <div className="notes-icon-picker-colors">
        {ICON_COLOR_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => setSelectedColor(name)}
            className="notes-icon-picker-color"
            data-selected={name === selectedColor}
            style={{ background: colorHex(name) }}
            aria-label={name}
          />
        ))}
      </div>

      {/* Remove option */}
      <button className="notes-icon-picker-remove" onClick={handleRemove}>
        <X size={12} strokeWidth={1.5} />
        {t("removeIcon")}
      </button>

      {/* Icon grid by category */}
      <div className="notes-icon-picker-grid-wrapper">
        {Object.entries(ICON_CATEGORIES).map(([category, iconNames]) => {
          const filtered = filterIcons(iconNames);
          if (filtered.length === 0) return null;

          return (
            <div key={category}>
              <div className="notes-icon-picker-category">{t(`icon${category.charAt(0).toUpperCase() + category.slice(1)}`)}</div>
              <div className="notes-icon-picker-grid">
                {filtered.map((name) => {
                  const IconComp = getIconComponent(name);
                  const isSelected = currentIcon?.name === name;
                  return (
                    <button
                      key={name}
                      onClick={() => handleSelectIcon(name)}
                      className="notes-icon-picker-icon"
                      data-selected={isSelected}
                      title={name}
                    >
                      <IconComp
                        size={18}
                        strokeWidth={1.5}
                        style={{ color: colorHex(selectedColor) }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS styles**

Add to the end of `app/globals.css`:

```css
/* Icon Picker */
.notes-icon-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 50;
  width: 320px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 12px;
  margin-top: 4px;
}

.dark .notes-icon-picker {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.notes-icon-picker-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--surface-hover);
  margin-bottom: 10px;
}

.notes-icon-picker-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--text-primary);
}

.notes-icon-picker-search input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.notes-icon-picker-colors {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  padding: 2px 0;
}

.notes-icon-picker-color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: transform 100ms ease;
}

.notes-icon-picker-color:hover {
  transform: scale(1.15);
}

.notes-icon-picker-color[data-selected="true"] {
  outline: 2px solid var(--text-muted);
  outline-offset: 2px;
}

.notes-icon-picker-remove {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 8px;
}

.notes-icon-picker-remove:hover {
  background: var(--surface-hover);
}

.notes-icon-picker-grid-wrapper {
  overflow-y: auto;
  flex: 1;
}

.notes-icon-picker-category {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  opacity: 0.5;
  margin-bottom: 6px;
  margin-top: 4px;
}

.notes-icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  margin-bottom: 10px;
}

.notes-icon-picker-icon {
  padding: 7px;
  text-align: center;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 100ms ease;
}

.notes-icon-picker-icon:hover {
  background: var(--surface-hover);
}

.notes-icon-picker-icon[data-selected="true"] {
  background: var(--surface-active);
}
```

- [ ] **Step 3: Verify component renders**

Run: `npm run dev`

The component isn't wired up yet — this is just the standalone creation. Verify no build errors by checking the terminal for compilation success.

- [ ] **Step 4: Commit**

```bash
git add components/notes/IconPicker.js app/globals.css
git commit -m "feat(notes): add IconPicker component with search and color picker"
```

---

### Task 4: Wire Icon into Sidebar (PageTreeItem)

**Files:**
- Modify: `components/notes/PageTreeItem.js:1-10,64-73`

- [ ] **Step 1: Replace icon rendering in PageTreeItem**

In `components/notes/PageTreeItem.js`:

Replace the icon imports at line 6:

```jsx
import { ChevronRight, MoreHorizontal, Plus, Trash2, Pencil, Copy } from "lucide-react";
```

(Remove `File, Folder, FolderOpen` — they're now handled by `NoteIcon`.)

Add the NoteIcon import:

```jsx
import NoteIcon from "./NoteIcon";
```

Replace the icon rendering block (lines 65-73) from:

```jsx
        <span className="flex-shrink-0 opacity-60" style={{ color: "var(--text-muted)" }}>
          {note.icon ? (
            <span className="text-[14px]">{note.icon}</span>
          ) : hasChildren ? (
            expanded ? <FolderOpen size={15} strokeWidth={1.5} /> : <Folder size={15} strokeWidth={1.5} />
          ) : (
            <File size={15} strokeWidth={1.5} />
          )}
        </span>
```

To:

```jsx
        <NoteIcon
          icon={note.icon}
          hasChildren={hasChildren}
          expanded={expanded}
          size={15}
        />
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`

Open a notes page. Sidebar should still show File/Folder icons for notes without custom icons (no visual change for existing notes). If any notes in the DB have `icon` data, they should render with the colored lucide icon.

- [ ] **Step 3: Commit**

```bash
git add components/notes/PageTreeItem.js
git commit -m "feat(notes): render custom icons in sidebar tree"
```

---

### Task 5: Wire Icon into Top Bar (NoteTopBar)

**Files:**
- Modify: `components/notes/NoteTopBar.js:6,66-69`

- [ ] **Step 1: Update NoteTopBar to show icon in breadcrumb**

In `components/notes/NoteTopBar.js`:

Replace the import line (line 6):

```jsx
import { ChevronRight, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
```

(Remove `File` — replaced by `NoteIcon`.)

Add the NoteIcon import:

```jsx
import NoteIcon from "./NoteIcon";
```

Replace the root-level breadcrumb block (lines 66-69) from:

```jsx
          <span className="current flex items-center gap-1.5">
            <File size={12} strokeWidth={1.5} />
            {note?.title || t("untitled")}
          </span>
```

To:

```jsx
          <span className="current flex items-center gap-1.5">
            <NoteIcon icon={note?.icon} hasChildren={false} expanded={false} size={14} fallbackOpacity={0.5} />
            {note?.title || t("untitled")}
          </span>
```

Also update the ancestor breadcrumb links (line 55) — add icon before the ancestor title. Change:

```jsx
                <Link href={`/notes/${ancestor.id}`}>{ancestor.title || t("untitled")}</Link>
```

To:

```jsx
                <Link href={`/notes/${ancestor.id}`} className="flex items-center gap-1">
                  <NoteIcon icon={ancestor.icon} hasChildren={false} expanded={false} size={12} fallbackOpacity={0.4} />
                  {ancestor.title || t("untitled")}
                </Link>
```

- [ ] **Step 2: Verify in browser**

Open a note that has ancestors. Breadcrumb should show icons before each name. Root notes show their icon (or default File icon).

- [ ] **Step 3: Commit**

```bash
git add components/notes/NoteTopBar.js
git commit -m "feat(notes): show page icons in breadcrumb"
```

---

### Task 6: Wire Icon into Editor + "Add Icon" Hint + Save

**Files:**
- Modify: `components/notes/NoteEditor.js:267-279`
- Modify: `app/[locale]/(app)/notes/[noteId]/page.js:67-88,264-286`

- [ ] **Step 1: Add icon display and picker to NoteEditor**

In `components/notes/NoteEditor.js`:

Add imports at the top (after existing imports):

```jsx
import NoteIcon from "./NoteIcon";
import IconPicker from "./IconPicker";
```

Add `onIconChange` to the destructured props:

```jsx
export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange }) {
```

Add state for the picker at the top of the component (after existing useState calls):

```jsx
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
```

Replace the return JSX (lines 267-295) with:

```jsx
  return (
    <div
      className="mx-auto px-6 md:px-16 pt-6 pb-[30vh]"
      style={{ maxWidth: "900px" }}
      onKeyDown={handleEditorKeyDown}
    >
      {/* Icon area: show icon or "Add icon" hint on hover */}
      <div className="relative" style={{ paddingLeft: "54px" }}>
        {note?.icon ? (
          <button
            onClick={() => setIconPickerOpen((prev) => !prev)}
            className="p-1 rounded-md mb-1 transition-opacity hover:opacity-80"
            style={{ cursor: "pointer" }}
          >
            <NoteIcon icon={note.icon} hasChildren={false} expanded={false} size={32} />
          </button>
        ) : (
          <button
            onClick={() => setIconPickerOpen((prev) => !prev)}
            className="notes-add-icon-hint flex items-center gap-1.5 px-2 py-1 rounded-md mb-1 text-xs"
          >
            <NoteIcon icon={null} hasChildren={false} expanded={false} size={14} fallbackOpacity={0.4} />
            {t("addIcon")}
          </button>
        )}
        {iconPickerOpen && (
          <IconPicker
            currentIcon={note?.icon}
            onSelect={(icon) => {
              onIconChange?.(icon);
              setIconPickerOpen(false);
            }}
            onClose={() => setIconPickerOpen(false)}
          />
        )}
      </div>

      <input
        className="notes-title-input mb-4"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder={t("untitled")}
        aria-label="Page title"
      />

      <BlockNoteView
        editor={editor}
        theme={theme === "dark" ? "dark" : "light"}
        onChange={handleContentChange}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
```

- [ ] **Step 2: Add CSS for "Add icon" hover hint**

Add to `app/globals.css`:

```css
/* Add icon hover hint */
.notes-add-icon-hint {
  opacity: 0;
  color: var(--text-muted);
  transition: opacity 150ms ease;
  cursor: pointer;
  background: transparent;
  border: none;
}

.notes-add-icon-hint:hover {
  background: var(--surface-hover);
}

/* Show hint when hovering the editor title area */
.mx-auto:hover .notes-add-icon-hint {
  opacity: 1;
}
```

- [ ] **Step 3: Wire icon save in [noteId]/page.js**

In `app/[locale]/(app)/notes/[noteId]/page.js`:

Add a `handleIconChange` callback after the existing `handleSave` (around line 88):

```jsx
  const handleIconChange = useCallback(
    async (icon) => {
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icon }),
        });
        const data = await res.json();
        if (data.success) {
          setCurrentNote((prev) => (prev ? { ...prev, icon } : prev));
          setNotes((prev) =>
            prev.map((n) => (n.id === noteId ? { ...n, icon } : n)),
          );
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [noteId, t],
  );
```

Add the `onIconChange` prop to the `NoteEditor` component (around line 278):

Change:
```jsx
          <NoteEditor
            key={currentNote.id}
            note={currentNote}
            onSave={handleSave}
            onSaveStatusChange={setEditorSaveStatus}
          />
```

To:
```jsx
          <NoteEditor
            key={currentNote.id}
            note={currentNote}
            onSave={handleSave}
            onSaveStatusChange={setEditorSaveStatus}
            onIconChange={handleIconChange}
          />
```

- [ ] **Step 4: Verify end-to-end**

Run: `npm run dev`

1. Open a note → hover over the title area → "Add icon" hint fades in
2. Click "Add icon" → picker popup appears with search, colors, icon grid
3. Pick a color → icons change color in real-time
4. Click an icon → picker closes, icon saves, appears above title
5. Icon also appears in sidebar tree and breadcrumb
6. Reopen picker → click "Remove icon" → icon removed from all locations

- [ ] **Step 5: Commit**

```bash
git add components/notes/NoteEditor.js app/[locale]/(app)/notes/[noteId]/page.js app/globals.css
git commit -m "feat(notes): add icon picker to editor with save integration"
```

---

### Task 7: Empty States

**Files:**
- Modify: `components/notes/PageTree.js:93-99`
- Modify: `components/notes/NoteEditor.js` (BlockNote placeholder)

- [ ] **Step 1: Improve empty sidebar state**

In `components/notes/PageTree.js`, replace the empty state block (lines 93-98):

```jsx
          <div className="px-3 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t("emptyState")}
            </p>
          </div>
```

With:

```jsx
          <div className="flex flex-col items-center px-3 py-10 text-center gap-2">
            <File size={32} strokeWidth={1} style={{ color: "var(--text-muted)", opacity: 0.15 }} />
            <p className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
              {t("noPages")}
            </p>
          </div>
```

Add `File` to the existing lucide-react imports at line 5:

```jsx
import { ChevronRight, File, Plus, Search, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Add BlockNote editor placeholder**

In `components/notes/NoteEditor.js`, update the `useCreateBlockNote` call to include a placeholder. The `useCreateBlockNote` hook from BlockNote accepts `placeholderText` in the dictionary option. Change:

```jsx
  const editor = useCreateBlockNote({
    initialContent: note?.content?.length > 0 ? note.content : undefined,
  });
```

To:

```jsx
  const editor = useCreateBlockNote({
    initialContent: note?.content?.length > 0 ? note.content : undefined,
    dictionary: {
      placeholders: {
        default: t("editorPlaceholder"),
      },
    },
  });
```

- [ ] **Step 3: Verify in browser**

1. Delete all notes (or create a new user) → sidebar shows File icon + "No pages yet" + existing "New page" button
2. Create a new note → empty editor shows placeholder "Enter text or type '/' for commands" in the first empty block

- [ ] **Step 4: Commit**

```bash
git add components/notes/PageTree.js components/notes/NoteEditor.js
git commit -m "feat(notes): add empty sidebar state and editor placeholder"
```

---

### Task 8: Sidebar Collapse Toggle

**Files:**
- Modify: `components/notes/NotesLayout.js` (major rewrite)
- Modify: `app/globals.css` (sidebar transition styles)

- [ ] **Step 1: Update NotesLayout with collapse state**

Replace the entire `components/notes/NotesLayout.js`:

```jsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronsLeft, Menu, PanelLeft } from "lucide-react";
import PageTree from "./PageTree";
import MobileSidebar from "./MobileSidebar";

const STORAGE_KEY_COLLAPSED = "notes-sidebar-collapsed";
const STORAGE_KEY_WIDTH = "notes-sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

function getInitialCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
  } catch {
    return false;
  }
}

function getInitialWidth() {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY_WIDTH), 10);
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export default function NotesLayout({
  notes,
  activeNoteId,
  onCreateNote,
  onDeleteNote,
  onReorder,
  onRename,
  onDuplicate,
  trashedNotes,
  onRestore,
  onPermanentDelete,
  children,
}) {
  const t = useTranslations("notes");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [sidebarWidth, setSidebarWidth] = useState(getInitialWidth);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
    } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth));
    } catch { /* ignore */ }
  }, [sidebarWidth]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const treeProps = {
    notes,
    activeNoteId,
    onCreateNote,
    onDeleteNote,
    onReorder,
    onRename,
    onDuplicate,
    trashedNotes,
    onRestore,
    onPermanentDelete,
  };

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside
        className="notes-sidebar hidden md:flex flex-col"
        style={{
          width: collapsed ? 0 : sidebarWidth,
          minWidth: collapsed ? 0 : sidebarWidth,
          boxShadow: collapsed ? "none" : "1px 0 0 0 var(--border)",
          overflow: "hidden",
          transition: "width 200ms ease-out, min-width 200ms ease-out",
        }}
      >
        {/* Sidebar header with collapse button */}
        <div className="flex items-center justify-between px-2 pt-2 pb-0" style={{ minWidth: sidebarWidth }}>
          <span className="text-xs font-medium px-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            {t("title")}
          </span>
          <button
            onClick={toggleCollapse}
            className="p-1 rounded"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label={t("collapseSidebar")}
          >
            <ChevronsLeft size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ minWidth: sidebarWidth }} className="flex-1 flex flex-col overflow-hidden">
          <PageTree {...treeProps} />
        </div>
      </aside>

      {/* Expand button (desktop, when collapsed) */}
      {collapsed && (
        <button
          onClick={toggleCollapse}
          className="hidden md:flex fixed z-30 p-2 rounded-lg items-center justify-center"
          style={{
            top: "4.75rem",
            left: "0.75rem",
            color: "var(--text-muted)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
          aria-label={t("expandSidebar")}
        >
          <PanelLeft size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-[4.5rem] left-4 z-30 p-2 rounded-lg"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        onClick={() => setDrawerOpen(true)}
        aria-label={t("openSidebar")}
      >
        <Menu size={16} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
      </button>

      <MobileSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} {...treeProps} />

      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--surface)" }}
      >
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update sidebar CSS for transitions**

In `app/globals.css`, update `.notes-sidebar`:

```css
.notes-sidebar {
  background: var(--background-secondary);
  overflow-y: auto;
  overscroll-behavior: contain;
  position: relative;
}
```

(Remove the `width: 240px; min-width: 240px;` — these are now inline styles controlled by React state.)

- [ ] **Step 3: Verify collapse behavior**

Run: `npm run dev`

1. Click « button → sidebar collapses with 200ms transition → PanelLeft button appears at top-left
2. Click PanelLeft button → sidebar expands back
3. Refresh page → collapsed state is preserved
4. Mobile still shows hamburger → drawer behavior unchanged

- [ ] **Step 4: Commit**

```bash
git add components/notes/NotesLayout.js app/globals.css
git commit -m "feat(notes): add sidebar collapse toggle with localStorage persistence"
```

---

### Task 9: Sidebar Drag Resize

**Files:**
- Modify: `components/notes/NotesLayout.js` (add resize handle)
- Modify: `app/globals.css` (resize handle styles)

- [ ] **Step 1: Add resize handle to NotesLayout**

In `components/notes/NotesLayout.js`, add resize state and handlers. Add these inside the component, after the existing state/effects:

```jsx
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      setIsResizing(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMouseMove = (moveEvent) => {
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, moveEvent.clientX));
        setSidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizing(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [],
  );

  const handleResizeDoubleClick = useCallback(() => {
    setSidebarWidth(DEFAULT_WIDTH);
  }, []);
```

Add the resize handle inside the `<aside>`, at the very end (before the closing `</aside>` tag):

```jsx
        {/* Resize handle */}
        {!collapsed && (
          <div
            className="notes-sidebar-resize-handle"
            onMouseDown={handleResizeStart}
            onDoubleClick={handleResizeDoubleClick}
            data-resizing={isResizing}
          />
        )}
```

- [ ] **Step 2: Add resize handle CSS**

Add to `app/globals.css`:

```css
/* Sidebar resize handle */
.notes-sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: -2px;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  transition: background 150ms ease;
}

.notes-sidebar-resize-handle:hover,
.notes-sidebar-resize-handle[data-resizing="true"] {
  background: var(--border);
}
```

- [ ] **Step 3: Verify resize behavior**

Run: `npm run dev`

1. Hover over right edge of sidebar → cursor changes to col-resize, subtle line appears
2. Drag → sidebar width changes smoothly between 200px and 480px
3. Release → width persisted in localStorage
4. Double-click handle → resets to 240px
5. Refresh → saved width restored

- [ ] **Step 4: Commit**

```bash
git add components/notes/NotesLayout.js app/globals.css
git commit -m "feat(notes): add sidebar drag-to-resize with constraints"
```

---

### Task 10: Sidebar Hover Peek

**Files:**
- Modify: `components/notes/NotesLayout.js` (add peek overlay)
- Modify: `app/globals.css` (peek styles)

- [ ] **Step 1: Add hover peek state and overlay**

In `components/notes/NotesLayout.js`, add peek state and handlers. Add after the resize state:

```jsx
  const [peekVisible, setPeekVisible] = useState(false);
  const peekTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
```

Add `useRef` to the import from React:

```jsx
import { useCallback, useEffect, useRef, useState } from "react";
```

Add peek handlers:

```jsx
  const showPeek = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    peekTimerRef.current = setTimeout(() => setPeekVisible(true), 200);
  }, []);

  const hidePeek = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => setPeekVisible(false), 300);
  }, []);

  const handlePeekNoteClick = useCallback(() => {
    setPeekVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);
```

Add the hover trigger zone and peek overlay after the expand button block, before the mobile menu button:

```jsx
      {/* Hover peek trigger zone (desktop, when collapsed) */}
      {collapsed && !peekVisible && (
        <div
          className="hidden md:block fixed top-16 left-0 bottom-0 z-20"
          style={{ width: "12px" }}
          onMouseEnter={showPeek}
        />
      )}

      {/* Peek overlay (desktop, when collapsed) */}
      {collapsed && peekVisible && (
        <>
          <div
            className="notes-drawer-backdrop hidden md:block"
            onClick={() => setPeekVisible(false)}
            aria-hidden="true"
          />
          <aside
            className="notes-peek-overlay hidden md:flex flex-col"
            style={{ width: sidebarWidth }}
            onMouseLeave={hidePeek}
            onMouseEnter={() => {
              if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
              }
            }}
          >
            <div onClick={handlePeekNoteClick}>
              <PageTree {...treeProps} />
            </div>
          </aside>
        </>
      )}
```

- [ ] **Step 2: Add peek overlay CSS**

Add to `app/globals.css`:

```css
/* Sidebar peek overlay */
.notes-peek-overlay {
  position: fixed;
  top: 4rem;
  left: 0;
  bottom: 0;
  z-index: 41;
  background: var(--background-secondary);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  animation: slideFromLeft 150ms ease-out both;
}

.dark .notes-peek-overlay {
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 3: Verify peek behavior**

Run: `npm run dev`

1. Collapse sidebar → PanelLeft button visible
2. Move mouse to left edge of viewport → after 200ms, sidebar peeks as floating overlay with backdrop
3. Mouse inside peek → stays visible
4. Mouse leaves peek → after 300ms, peek hides
5. Click a note in peek → navigates to note AND peek closes
6. Click backdrop → peek closes

- [ ] **Step 4: Commit**

```bash
git add components/notes/NotesLayout.js app/globals.css
git commit -m "feat(notes): add sidebar hover peek when collapsed"
```

---

### Task 11: Final Integration Test

**Files:**
- Create: `tests/unit/notes-icon-integration.test.js`

- [ ] **Step 1: Write integration test for icon data flow**

Create `tests/unit/notes-icon-integration.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  ICON_MAP,
  ICON_CATEGORIES,
  ICON_COLOR_NAMES,
  getIconComponent,
  getIconColor,
} from "@/lib/notes/iconMap";

describe("icon data integration", () => {
  it("icon data model shape is valid", () => {
    // Simulate what the API stores
    const iconData = { name: "file-text", color: "blue" };

    expect(ICON_MAP[iconData.name]).toBeDefined();
    expect(ICON_COLOR_NAMES).toContain(iconData.color);
  });

  it("null icon returns fallback component", () => {
    const comp = getIconComponent(undefined);
    expect(comp).toBeDefined();
  });

  it("all 60 icons are distributed across categories", () => {
    const allCategoryIcons = Object.values(ICON_CATEGORIES).flat();
    expect(allCategoryIcons.length).toBe(60);
    // No duplicates
    expect(new Set(allCategoryIcons).size).toBe(60);
  });

  it("each color has both light and dark variants", () => {
    for (const color of ICON_COLOR_NAMES) {
      const light = getIconColor(color, "light");
      const dark = getIconColor(color, "dark");
      expect(light).toBeTruthy();
      expect(dark).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run all notes tests**

Run: `npm run test -- tests/unit/notes-icon`
Expected: All tests pass.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 4: Commit test**

```bash
git add tests/unit/notes-icon-integration.test.js
git commit -m "test(notes): add icon data integration tests"
```

- [ ] **Step 5: Manual verification checklist**

Run through this checklist in the browser (`npm run dev`):

- [ ] Title and editor text are left-aligned (54px padding match)
- [ ] Hover title area → "Add icon" hint fades in
- [ ] Click "Add icon" → picker opens, search works, colors change icon preview
- [ ] Select icon → saves to DB, appears in sidebar + breadcrumb + editor
- [ ] Remove icon → reverts to default File/Folder icon
- [ ] Sidebar collapse « → smooth 200ms transition → PanelLeft button appears
- [ ] PanelLeft click → sidebar expands
- [ ] Hover left edge when collapsed → peek overlay after 200ms
- [ ] Click note in peek → navigates + closes peek
- [ ] Drag sidebar right edge → resize between 200-480px
- [ ] Double-click resize handle → resets to 240px
- [ ] Refresh → all states (collapsed, width) persisted
- [ ] Empty sidebar → File icon + "No pages yet"
- [ ] New note → editor placeholder "Enter text or type '/' for commands"
- [ ] Mobile → hamburger button, drawer works as before
- [ ] Dark mode → all features work, icon colors use dark variants
