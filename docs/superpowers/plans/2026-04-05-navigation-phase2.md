# Navigation Redesign Phase 2 (2a + 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapsible sidebar, mobile overflow menu, capture-document persistence, and desktop BlockNote Inbox editor.

**Architecture:** Phase 2a adds UI refinements (collapsible sidebar + global overflow menu) with no backend changes. Phase 2b introduces a capture-document model (special note with `type: "inbox-capture"`) and a desktop-only BlockNote editor that conditionally replaces the mobile CaptureInput at the md breakpoint.

**Tech Stack:** Next.js 15, Tailwind CSS 4, BlockNote 0.47.3, MongoDB, next-intl 4

**Branch:** `UI-design`

**Spec:** `docs/superpowers/specs/2026-04-05-navigation-phase2-design.md`

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `components/layout/Sidebar.js` | Collapsible desktop sidebar | Modify |
| `components/layout/Navbar.js` | Global mobile overflow menu | Modify |
| `hooks/useMediaQuery.js` | Client-only responsive breakpoint hook | Create |
| `app/api/inbox/capture/route.js` | GET + PATCH capture document API | Create |
| `app/api/notes/route.js` | Filter out inbox-capture from listing | Modify |
| `app/api/notes/trash/route.js` | Filter out inbox-capture from trash | Modify |
| `app/api/notes/[noteId]/route.js` | Guard capture docs from generic PATCH/DELETE | Modify |
| `scripts/create-capture-index.js` | Create unique partial index for capture docs | Create |
| `components/inbox/InboxEditor.js` | Desktop BlockNote editor for Inbox | Create |
| `app/[locale]/(app)/inbox/page.js` | Conditional desktop/mobile rendering | Modify |
| `messages/en.json` | New translation keys | Modify |
| `messages/zh-TW.json` | New translation keys | Modify |

---

## Phase 2a: UI Refinements

### Task 1: Collapsible Sidebar

**Files:**
- Modify: `components/layout/Sidebar.js`

- [ ] **Step 1: Add collapse state with localStorage persistence**

Add state, effect for reading localStorage, and a toggle handler. Insert these at the top of the `Sidebar` component body, after the existing hook calls:

```javascript
const [collapsed, setCollapsed] = useState(false);

useEffect(() => {
  const stored = localStorage.getItem("sidebar-collapsed");
  if (stored === "true") setCollapsed(true);
}, []);

const toggleCollapse = () => {
  setCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem("sidebar-collapsed", String(next));
    return next;
  });
};
```

- [ ] **Step 2: Add toggle button at top of sidebar**

Add a toggle button before the `<nav>` element inside the `<aside>`. Import `FaChevronLeft, FaChevronRight` from `react-icons/fa`.

```jsx
<div className="flex items-center justify-end px-2.5 pt-3 pb-1">
  <button
    onClick={toggleCollapse}
    className="p-1.5 rounded-md transition-colors"
    style={{ color: "var(--text-muted)" }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
  >
    {collapsed ? <FaChevronRight size={12} /> : <FaChevronLeft size={12} />}
  </button>
</div>
```

- [ ] **Step 3: Update aside width and transition**

Change the `<aside>` className to use dynamic width:

```jsx
<aside
  className={`hidden md:flex flex-col flex-shrink-0 border-r transition-[width] duration-200 ease-out ${
    collapsed ? "w-[56px]" : "w-[210px]"
  }`}
  style={{
    backgroundColor: "var(--navbar-bg)",
    borderColor: "var(--navbar-border)",
  }}
  role="navigation"
  aria-label={t("mainNavigation")}
>
```

- [ ] **Step 4: Update renderItem for collapsed state**

Modify `renderItem` to hide label text and show tooltip when collapsed:

```javascript
const renderItem = ({ href, icon: Icon, labelKey }) => {
  const active = isActive(pathname, href);
  return (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? t(labelKey) : undefined}
      className={`
        relative flex items-center ${collapsed ? "justify-center" : "gap-3"} 
        ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"} rounded-lg text-[13.5px] font-medium
        transition-colors duration-150
        ${active
          ? "bg-[var(--primary-light)] text-[var(--primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        }
      `}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm"
          style={{ backgroundColor: "var(--primary)" }}
        />
      )}
      <Icon size={16} aria-hidden="true" />
      {!collapsed && <span>{t(labelKey)}</span>}
    </Link>
  );
};
```

- [ ] **Step 5: Update workspace label and user section for collapsed state**

Hide "Workspace" label and username when collapsed:

```jsx
{/* Workspace label — hide when collapsed */}
{!collapsed && (
  <div
    className="pt-4 pb-1.5 px-3 text-[10px] font-medium uppercase tracking-widest"
    style={{ color: "var(--text-muted)" }}
  >
    {t("workspace")}
  </div>
)}
{collapsed && <div className="pt-3" />}

{/* User section — only avatar when collapsed */}
{session?.user && (
  <div
    className={`${collapsed ? "px-2" : "px-3"} py-3 border-t`}
    style={{ borderColor: "var(--navbar-border)" }}
  >
    <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-2"}`}>
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={{
          backgroundColor: "var(--primary-light)",
          color: "var(--primary)",
        }}
      >
        {(session.user.name || "U")[0].toUpperCase()}
      </div>
      {!collapsed && (
        <span
          className="text-[12.5px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {session.user.name}
        </span>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: Test collapse behavior**

Run: `npm run dev`

At 1024px viewport:
- Sidebar starts expanded (or collapsed if localStorage says so)
- Click chevron → sidebar collapses to 56px, only icons visible
- Hover shows tooltip with label text
- Active indicator bar visible in both states
- Refresh → collapsed state persists
- Click chevron again → expands back to 210px

- [ ] **Step 7: Commit**

```bash
git add components/layout/Sidebar.js
git commit -m "feat: add collapsible sidebar with localStorage persistence"
```

---

### Task 2: Mobile Overflow Menu in Navbar

**Files:**
- Modify: `components/layout/Navbar.js`

- [ ] **Step 1: Add overflow menu state and imports**

Add `FaEllipsisH, FaList` to imports, add `useClickOutside` hook import, and add dropdown state:

```javascript
import { FaEllipsisH, FaList } from "react-icons/fa";
import { useRef } from "react";
```

Add inside the component:

```javascript
const [overflowOpen, setOverflowOpen] = useState(false);
const overflowRef = useRef(null);

// Close on outside click
useEffect(() => {
  const handler = (e) => {
    if (overflowRef.current && !overflowRef.current.contains(e.target)) {
      setOverflowOpen(false);
    }
  };
  if (overflowOpen) document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, [overflowOpen]);
```

- [ ] **Step 2: Add overflow button and dropdown — mobile only**

Add before the locale switcher button, inside the `{session ? (...)` block. This is only visible on mobile (`md:hidden`):

```jsx
{/* Mobile overflow menu */}
<div className="relative md:hidden" ref={overflowRef}>
  <button
    onClick={() => setOverflowOpen((prev) => !prev)}
    className="p-2 rounded-lg bg-background-tertiary text-text-primary hover:bg-surface-active transition-colors"
    aria-label={t("more")}
    aria-expanded={overflowOpen}
  >
    <FaEllipsisH className="text-sm" />
  </button>
  {overflowOpen && (
    <div
      className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-50 py-1"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <Link
        href="/reminders"
        className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors"
        style={{ color: "var(--text-primary)" }}
        onClick={() => setOverflowOpen(false)}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <FaList size={14} style={{ color: "var(--text-muted)" }} />
        {t("all")}
      </Link>
    </div>
  )}
</div>
```

- [ ] **Step 3: Add translation key**

The `t("more")` key is needed. Add to both translation files.

In `messages/en.json`, in `"nav"` section:
```json
"more": "More"
```

In `messages/zh-TW.json`, in `"nav"` section:
```json
"more": "更多"
```

- [ ] **Step 4: Test**

At 375px viewport:
- Three-dot button visible in Navbar
- Tapping opens dropdown with "All" link
- Tapping "All" navigates to `/reminders`
- Tapping outside closes dropdown
- Button hidden on desktop (md+)

- [ ] **Step 5: Commit**

```bash
git add components/layout/Navbar.js messages/en.json messages/zh-TW.json
git commit -m "feat: add global mobile overflow menu for All Tasks access"
```

---

## Phase 2b: Inbox Editor Core

### Task 3: Create useMediaQuery hook

**Files:**
- Create: `hooks/useMediaQuery.js`
- Create: `tests/unit/useMediaQuery.test.js`

- [ ] **Step 1: Write the test**

```javascript
// tests/unit/useMediaQuery.test.js
import { describe, it, expect, vi } from "vitest";

// useMediaQuery is a client-only React hook that uses window.matchMedia.
// We test the logic by verifying the module exports correctly.
// Full integration testing requires a browser environment.
describe("useMediaQuery module", () => {
  it("exports a default function", async () => {
    const mod = await import("@/hooks/useMediaQuery");
    expect(typeof mod.default).toBe("function");
  });
});
```

- [ ] **Step 2: Write the hook**

```javascript
// hooks/useMediaQuery.js
"use client";

import { useState, useEffect } from "react";

export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- tests/unit/useMediaQuery.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add hooks/useMediaQuery.js tests/unit/useMediaQuery.test.js
git commit -m "feat: add useMediaQuery hook for responsive breakpoints"
```

---

### Task 4: Create capture document API

**Files:**
- Create: `app/api/inbox/capture/route.js`
- Create: `scripts/create-capture-index.js`

- [ ] **Step 1: Create the API route**

```javascript
// app/api/inbox/capture/route.js
import { auth } from "@/auth";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

// GET /api/inbox/capture — returns the user's capture document (creates if not exists)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const collection = await getNotesCollection();

    let doc = await collection.findOne({
      userId: session.user.id,
      type: "inbox-capture",
    });

    if (!doc) {
      const now = new Date();
      const newDoc = {
        userId: session.user.id,
        title: "Inbox",
        type: "inbox-capture",
        content: [],
        parentId: null,
        icon: null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const result = await collection.insertOne(newDoc);
      doc = { ...newDoc, _id: result.insertedId };
    }

    return apiSuccess(formatNote(doc));
  } catch (error) {
    // Handle duplicate key from race condition — retry find
    if (error.code === 11000) {
      const collection = await getNotesCollection();
      const session = await auth();
      const doc = await collection.findOne({
        userId: session.user.id,
        type: "inbox-capture",
      });
      if (doc) return apiSuccess(formatNote(doc));
    }
    console.error("GET /api/inbox/capture error:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/inbox/capture — update capture document content
export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { content } = body;

    if (content !== undefined && !Array.isArray(content)) {
      return apiError("content must be an array", 400);
    }

    const collection = await getNotesCollection();

    const updateData = { updatedAt: new Date() };
    if (content !== undefined) updateData.content = content;

    const updated = await collection.findOneAndUpdate(
      { userId: session.user.id, type: "inbox-capture" },
      { $set: updateData },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError("Capture document not found", 404);
    }

    return apiSuccess(formatNote(updated));
  } catch (error) {
    console.error("PATCH /api/inbox/capture error:", error);
    return apiError("Internal server error", 500);
  }
}
```

- [ ] **Step 2: Create the index script**

```javascript
// scripts/create-capture-index.js
import { getNotesCollection } from "../lib/notes/db.js";

async function createCaptureIndex() {
  const collection = await getNotesCollection();

  await collection.createIndex(
    { userId: 1, type: 1 },
    {
      unique: true,
      partialFilterExpression: { type: "inbox-capture" },
      name: "unique_inbox_capture_per_user",
    }
  );

  console.log("Created unique partial index: unique_inbox_capture_per_user");
  process.exit(0);
}

createCaptureIndex().catch((err) => {
  console.error("Failed to create index:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the index script**

Run: `node scripts/create-capture-index.js`
Expected: "Created unique partial index: unique_inbox_capture_per_user"

- [ ] **Step 4: Commit**

```bash
git add app/api/inbox/capture/route.js scripts/create-capture-index.js
git commit -m "feat: add capture document API with unique partial index"
```

---

### Task 5: Filter capture docs from notes APIs

**Files:**
- Modify: `app/api/notes/route.js`
- Modify: `app/api/notes/trash/route.js`
- Modify: `app/api/notes/[noteId]/route.js`

- [ ] **Step 1: Filter from notes listing**

In `app/api/notes/route.js`, line 20, update the find query to exclude capture docs:

```javascript
// Old:
const notes = await notesCollection
  .find({ userId: session.user.id, deletedAt: null })
  .sort({ updatedAt: -1 })
  .toArray();

// New:
const notes = await notesCollection
  .find({ userId: session.user.id, deletedAt: null, type: { $ne: "inbox-capture" } })
  .sort({ updatedAt: -1 })
  .toArray();
```

- [ ] **Step 2: Filter from trash listing**

In `app/api/notes/trash/route.js`, line 15, update the find query:

```javascript
// Old:
const notes = await notesCollection
  .find({
    userId: session.user.id,
    deletedAt: { $ne: null },
  })

// New:
const notes = await notesCollection
  .find({
    userId: session.user.id,
    deletedAt: { $ne: null },
    type: { $ne: "inbox-capture" },
  })
```

- [ ] **Step 3: Guard PATCH and DELETE for capture docs**

In `app/api/notes/[noteId]/route.js`, add a guard at the top of both PATCH and DELETE handlers. After fetching the note but before modifying it, check the type:

For PATCH (after the note query around line 105, before `findOneAndUpdate`), add:

```javascript
// Guard: prevent modifying capture documents via generic note API
const existingNote = await notesCollection.findOne({
  _id: new ObjectId(noteId),
  userId: session.user.id,
});
if (existingNote?.type === "inbox-capture") {
  return apiError("Use /api/inbox/capture to modify the capture document", 403);
}
```

For DELETE (after the note is fetched at line 141, after the `if (!note)` check), add:

```javascript
if (note.type === "inbox-capture") {
  return apiError("Capture document cannot be deleted", 403);
}
```

- [ ] **Step 4: Run existing tests**

Run: `npm run test`
Expected: All tests pass. No regressions.

- [ ] **Step 5: Commit**

```bash
git add app/api/notes/route.js app/api/notes/trash/route.js app/api/notes/[noteId]/route.js
git commit -m "feat: filter capture docs from notes APIs, add PATCH/DELETE guards"
```

---

### Task 6: Create InboxEditor component

**Files:**
- Create: `components/inbox/InboxEditor.js`

- [ ] **Step 1: Create the desktop BlockNote editor for Inbox**

This component reuses BlockNote config from NoteEditor but saves to the capture document API instead of a note. No title input, no icon picker.

```javascript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core";
import { en as bnEn } from "@blocknote/core/locales";
import "@blocknote/mantine/style.css";
import { Sparkles } from "lucide-react";
import TaskItem from "@/components/tasks/TaskItem";

export default function InboxEditor({ tasks, onToggleComplete, onDelete, onEdit }) {
  const t = useTranslations("inbox");
  const tNotes = useTranslations("notes");
  const locale = useLocale();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const saveTimerRef = useRef(null);
  const initialContentRef = useRef(null);

  const editor = useCreateBlockNote({
    dictionary: {
      ...bnEn,
      placeholders: {
        ...bnEn.placeholders,
        default: t("editorPlaceholder"),
      },
    },
  });

  // Fetch capture document on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/inbox/capture");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data.content?.length > 0) {
          editor.replaceBlocks(editor.document, data.data.content);
          initialContentRef.current = data.data.content;
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContentChange = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const content = editor.document;
      setSaveStatus("saving");
      try {
        await fetch("/api/inbox/capture", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus(null);
      }
    }, 1000);
  }, [editor]);

  const executeAiCommand = useCallback(
    async (type, input, afterBlockId) => {
      const blocks = editor.document;
      const noteContext = blocks
        .map((b) => b.content?.map((c) => c.text || "").join("") || "")
        .filter(Boolean)
        .join("\n");

      let commandBlock;
      if (afterBlockId) {
        commandBlock = editor.getBlock(afterBlockId);
      } else {
        const currentBlock = editor.getTextCursorPosition().block;
        const commandText = `/${type}${input ? " " + input : ""}`;
        [commandBlock] = editor.insertBlocks(
          [{
            type: "paragraph",
            content: [{ type: "text", text: commandText, styles: { italic: true, textColor: "purple" } }],
          }],
          currentBlock,
          "after",
        );
      }

      const [loadingBlock] = editor.insertBlocks(
        [{ type: "paragraph", content: [{ type: "text", text: "Generating...", styles: { italic: true } }] }],
        commandBlock,
        "after",
      );

      try {
        const res = await fetch("/api/ai/notes-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: type,
            input: input || noteContext,
            noteTitle: "Inbox",
            noteContext,
            language: locale?.startsWith("zh") ? "zh" : "en",
          }),
        });
        if (!res.ok) throw new Error("AI request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          editor.updateBlock(loadingBlock, {
            type: "paragraph",
            content: [{ type: "text", text: accumulated, styles: { italic: true } }],
          });
        }

        const parsedBlocks = await editor.tryParseMarkdownToBlocks(accumulated);
        editor.removeBlocks([loadingBlock]);
        if (parsedBlocks.length > 0) {
          editor.insertBlocks(parsedBlocks, commandBlock, "after");
        }
      } catch {
        editor.updateBlock(loadingBlock, {
          type: "paragraph",
          content: [{ type: "text", text: "Failed to get AI response.", styles: { italic: true } }],
        });
      }
    },
    [editor, locale],
  );

  const getSlashMenuItems = useCallback(
    (editorInstance) => {
      const defaultItems = getDefaultReactSlashMenuItems(editorInstance);
      const aiItems = [
        {
          title: tNotes("askAi"),
          onItemClick: () => executeAiCommand("ask", ""),
          subtext: tNotes("askAiSubtext"),
          aliases: ["ask", "ai"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
        {
          title: tNotes("summarize"),
          onItemClick: () => executeAiCommand("summarize", ""),
          subtext: tNotes("summarizeSubtext"),
          aliases: ["summarize", "summary"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
        {
          title: tNotes("digestLabel"),
          onItemClick: () => executeAiCommand("digest", ""),
          subtext: tNotes("digestSubtext"),
          aliases: ["digest"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
      ];
      return [...defaultItems, ...aiItems];
    },
    [executeAiCommand, tNotes],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-40 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Editor toolbar */}
      <div className="flex items-center gap-2 mb-3">
        {saveStatus && (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {saveStatus === "saving" ? t("saving") : t("saved")}
          </span>
        )}
      </div>

      {/* BlockNote editor */}
      <div
        className="rounded-xl mb-6"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          minHeight: "200px",
        }}
      >
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

      {/* Captured Tasks section */}
      {tasks.length > 0 && (
        <>
          <div
            className="text-[11px] font-semibold mb-2 px-1"
            style={{ color: "var(--text-muted)" }}
          >
            {t("capturedTasks")} <span className="font-normal">{tasks.length}</span>
          </div>
          <div className="space-y-0.5">
            {tasks.map((task) => (
              <TaskItem
                key={task._id || task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/InboxEditor.js
git commit -m "feat: add InboxEditor component with BlockNote + capture document"
```

---

### Task 7: Update Inbox page with conditional rendering

**Files:**
- Modify: `app/[locale]/(app)/inbox/page.js`

- [ ] **Step 1: Add useMediaQuery and InboxEditor imports**

Add at top of imports:

```javascript
import useMediaQuery from "@/hooks/useMediaQuery";
import InboxEditor from "@/components/inbox/InboxEditor";
```

- [ ] **Step 2: Add media query hook call**

Inside the component, after the existing hooks:

```javascript
const isDesktop = useMediaQuery("(min-width: 768px)");
```

- [ ] **Step 3: Conditionally render desktop vs mobile**

Replace the content section (after the title/subtitle, before TaskDetailPanel) with a conditional:

```jsx
{isDesktop ? (
  <InboxEditor
    tasks={tasks}
    onToggleComplete={toggleComplete}
    onDelete={deleteTask}
    onEdit={(id) => setSelectedTaskId(id)}
  />
) : (
  <>
    <CaptureInput onTaskAdded={handleTaskDetected} />
    <RecentFeed
      tasks={tasks}
      onToggleComplete={toggleComplete}
      onDelete={deleteTask}
      onEdit={(id) => setSelectedTaskId(id)}
    />
  </>
)}
```

- [ ] **Step 4: Add translation keys**

In `messages/en.json`, in `"inbox"` section:
```json
"editorPlaceholder": "Type anything... tasks, notes, ideas",
"saving": "Saving...",
"saved": "Saved",
"capturedTasks": "Captured Tasks"
```

In `messages/zh-TW.json`, in `"inbox"` section:
```json
"editorPlaceholder": "隨手寫下任何想法...",
"saving": "儲存中...",
"saved": "已儲存",
"capturedTasks": "已捕捉的任務"
```

- [ ] **Step 5: Test both viewports**

Run: `npm run dev`

Mobile (375px):
- CaptureInput + RecentFeed (same as Phase 1)
- No BlockNote editor

Desktop (1024px):
- Full BlockNote editor at top
- Type text, see auto-save indicator
- Slash menu works (/, AI commands available)
- Captured Tasks section below shows task list
- Refresh → content persists

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/(app)/inbox/page.js messages/en.json messages/zh-TW.json
git commit -m "feat: conditional desktop/mobile Inbox with BlockNote editor"
```

---

### Task 8: Integration smoke test

**Files:** None (verification only)

- [ ] **Step 1: Test collapsible sidebar**

Desktop 1024px:
1. Sidebar expanded by default (210px)
2. Click chevron → collapses to 56px, icons only
3. Hover icon → tooltip shows label
4. Active indicator bar visible
5. Refresh → stays collapsed
6. Click chevron → expands, refresh → stays expanded

- [ ] **Step 2: Test mobile overflow menu**

Mobile 375px:
1. Three-dot button in Navbar
2. Tap → "All" link appears
3. Tap "All" → navigates to `/reminders`
4. Not visible on desktop

- [ ] **Step 3: Test desktop Inbox editor**

Desktop 1024px:
1. Navigate to Inbox
2. BlockNote editor visible with placeholder text
3. Type text → auto-saves after 1s
4. Type `/` → slash menu with AI commands
5. Refresh → content preserved
6. Captured Tasks section shows below editor

- [ ] **Step 4: Test mobile Inbox unchanged**

Mobile 375px:
1. Navigate to Inbox
2. CaptureInput visible (not BlockNote)
3. RecentFeed shows mixed tasks + notes
4. Same as Phase 1

- [ ] **Step 5: Test capture doc filtering**

1. Create notes via Notes tab → they appear in Notes list
2. Inbox capture document does NOT appear in Notes list
3. Inbox capture document does NOT appear in trash

- [ ] **Step 6: Run tests and lint**

Run: `npm run test && npm run lint`
Expected: All tests pass, no lint errors.
