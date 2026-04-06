# Inbox Note-Based AI Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace structured InboxInput with a BlockNote editor-based inbox that uses AI to extract tasks from free-form text.

**Architecture:** Inbox page reuses the NoteEditor component (BlockNote) from the Notes system. A single "inbox" document lives in the notes collection (guarded by unique partial index). Users write freely, then click "Extract Tasks" to have AI parse the content into structured task cards they can confirm into the reminder system.

**Tech Stack:** Next.js 15, BlockNote, Vercel AI SDK (generateText), Zod, MongoDB, Lucide icons, next-intl, sonner (toasts)

**Spec:** `docs/superpowers/specs/2026-04-06-inbox-note-ai-design.md`

---

### Task 1: DB — Inbox Note Index

**Files:**
- Create: `scripts/create-inbox-note-index.js`

- [ ] **Step 1: Write the index creation script**

```javascript
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function createIndex() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const notes = db.collection("notes");

    const result = await notes.createIndex(
      { userId: 1, type: 1 },
      {
        unique: true,
        partialFilterExpression: { type: "inbox" },
        name: "inbox_note_unique",
      },
    );
    console.log("Created inbox note index:", result);
  } finally {
    await client.close();
  }
}

createIndex().catch(console.error);
```

- [ ] **Step 2: Run the script**

Run: `node scripts/create-inbox-note-index.js`
Expected: `Created inbox note index: inbox_note_unique`

- [ ] **Step 3: Commit**

```bash
git add scripts/create-inbox-note-index.js
git commit -m "chore: add unique partial index for inbox note document"
```

---

### Task 2: i18n — Add New Translation Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh-TW.json`

- [ ] **Step 1: Add new keys to en.json**

Add these keys inside the existing `"inbox"` namespace (after `"newTodo"`). Keep old keys — they'll be removed in Task 10.

```json
"extractTasks": "Extract Tasks",
"extracting": "Extracting...",
"extractedTasks": "Extracted Tasks",
"confirmAll": "Confirm All",
"noTasks": "No tasks found in your writing.",
"confirmed": "Task created",
"confirmFailed": "Failed to create task",
"dismissed": "Dismissed",
"reExtractWarning": "Unconfirmed tasks will be replaced.",
"partialSuccess": "{success} created, {failed} failed"
```

- [ ] **Step 2: Add corresponding keys to zh-TW.json**

```json
"extractTasks": "提取任務",
"extracting": "提取中...",
"extractedTasks": "已提取的任務",
"confirmAll": "全部確認",
"noTasks": "未在內容中找到任務。",
"confirmed": "任務已建立",
"confirmFailed": "任務建立失敗",
"dismissed": "已忽略",
"reExtractWarning": "未確認的任務將被替換。",
"partialSuccess": "已建立 {success} 項，{failed} 項失敗"
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh-TW.json
git commit -m "feat(i18n): add inbox AI extraction translation keys"
```

---

### Task 3: API — Inbox Note Endpoints + Notes Route Guards

**Files:**
- Create: `app/api/inbox/note/route.js`
- Modify: `app/api/notes/route.js:19-21` (GET query filter)
- Modify: `app/api/notes/trash/route.js:14-17` (GET query filter)
- Modify: `app/api/notes/[noteId]/route.js:44-58` (PATCH guard), `:123-148` (DELETE guard)
- Modify: `app/api/notes/reorder/route.js:39-43` (skip inbox in reorder)

- [ ] **Step 1: Create inbox note API route**

Create `app/api/inbox/note/route.js`:

```javascript
import { auth } from "@/auth";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

// POST /api/inbox/note — Get-or-create the inbox note for the current user
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const notesCollection = await getNotesCollection();
    const now = new Date();

    const doc = await notesCollection.findOneAndUpdate(
      { userId: session.user.id, type: "inbox" },
      {
        $setOnInsert: {
          title: "Inbox",
          content: [],
          parentId: null,
          icon: null,
          sortOrder: 0,
          createdAt: now,
          deletedAt: null,
        },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );

    return apiSuccess(formatNote(doc));
  } catch (error) {
    console.error("POST /api/inbox/note error:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/inbox/note — Save inbox content
export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { content } = body;

    if (content !== undefined && !Array.isArray(content)) {
      return apiError("content must be an array", 400);
    }

    const notesCollection = await getNotesCollection();

    const updated = await notesCollection.findOneAndUpdate(
      { userId: session.user.id, type: "inbox" },
      { $set: { content, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError("Inbox note not found", 404);
    }

    return apiSuccess(formatNote(updated));
  } catch (error) {
    console.error("PATCH /api/inbox/note error:", error);
    return apiError("Internal server error", 500);
  }
}
```

- [ ] **Step 2: Exclude inbox from GET /api/notes**

In `app/api/notes/route.js`, modify the `.find()` query on line 20 — add `type: { $ne: "inbox" }`:

```javascript
    const notes = await notesCollection
      .find({ userId: session.user.id, deletedAt: null, type: { $ne: "inbox" } })
      .sort({ updatedAt: -1 })
      .toArray();
```

- [ ] **Step 3: Exclude inbox from GET /api/notes/trash**

In `app/api/notes/trash/route.js`, modify the `.find()` query on line 14-16 — add `type: { $ne: "inbox" }`:

```javascript
    const notes = await notesCollection
      .find({
        userId: session.user.id,
        deletedAt: { $ne: null },
        type: { $ne: "inbox" },
      })
      .sort({ deletedAt: -1 })
      .toArray();
```

- [ ] **Step 4: Guard inbox in PATCH/DELETE /api/notes/[noteId]**

In `app/api/notes/[noteId]/route.js`, add a guard at the start of the PATCH handler (after line 58, after `body` is parsed), before building updateData:

```javascript
    // Guard: prevent modifying inbox document title/type via generic route
    const existingNote = await notesCollection.findOne({
      _id: new ObjectId(noteId),
      userId: session.user.id,
    });
    if (existingNote?.type === "inbox") {
      // Allow content updates only
      if (title !== undefined || parentId !== undefined || sortOrder !== undefined) {
        return apiError("Cannot modify inbox note properties", 403);
      }
    }
```

In the DELETE handler (after line 141, after the note is fetched), add:

```javascript
    if (note.type === "inbox") {
      return apiError("Cannot delete inbox note", 403);
    }
```

- [ ] **Step 5: Skip inbox in reorder**

In `app/api/notes/reorder/route.js`, after fetching `userNotes` on line 39-42, add a lookup to filter inbox from updates:

```javascript
    // Find inbox note to exclude from reorder
    const inboxNote = userNotes.find((n) => n.type === "inbox");
    const inboxId = inboxNote?._id.toString();

    // Filter out any reorder entry targeting the inbox note
    const filteredUpdates = inboxId
      ? updates.filter((item) => item.id !== inboxId)
      : updates;
```

Then replace all subsequent references to `updates` with `filteredUpdates` (in the validation loop starting line 58, and in the `ops` mapping on line 87). If `filteredUpdates` is empty, return early with success.

Note: `userNotes` projection needs `type` added — change line 41 to `.project({ _id: 1, parentId: 1, type: 1 })`.

- [ ] **Step 6: Verify notes pages still work**

Run: `npm run build`
Expected: No build errors. Notes pages unaffected.

- [ ] **Step 7: Commit**

```bash
git add app/api/inbox/note/route.js app/api/notes/route.js app/api/notes/trash/route.js app/api/notes/[noteId]/route.js app/api/notes/reorder/route.js
git commit -m "feat(api): add inbox note endpoints, guard notes routes against inbox document"
```

---

### Task 4: Util — blocksToText

**Files:**
- Create: `lib/notes/blocksToText.js`

- [ ] **Step 1: Write blocksToText utility**

This recursively walks BlockNote block tree and concatenates all text content. Unlike `preview.js`, it does NOT truncate.

```javascript
/**
 * Convert BlockNote blocks to plain text.
 * Recursively walks the block tree, concatenating inline text content.
 * Does NOT truncate — returns the full text for AI processing.
 */
export function blocksToText(blocks) {
  if (!blocks || !Array.isArray(blocks)) return "";

  const lines = [];

  for (const block of blocks) {
    // Extract inline text from this block's content array
    if (block.content && Array.isArray(block.content)) {
      const inlineText = block.content
        .map((inline) => (inline.type === "text" && inline.text) || "")
        .join("");
      if (inlineText) {
        lines.push(inlineText);
      }
    }

    // Recurse into nested children (sub-blocks, e.g., list items)
    if (block.children && Array.isArray(block.children)) {
      const childText = blocksToText(block.children);
      if (childText) {
        lines.push(childText);
      }
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/notes/blocksToText.js
git commit -m "feat: add blocksToText utility for full-text extraction from BlockNote blocks"
```

---

### Task 5: API — Extract Tasks Endpoint

**Files:**
- Create: `app/api/ai/extract-tasks/route.js`

- [ ] **Step 1: Write the extract-tasks API route**

```javascript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getModel } from "@/lib/ai/provider.js";
import { generateText } from "ai";

const MAX_INPUT_LENGTH = 8000;

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { text, language = "zh" } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: "Text is required" },
        { status: 400 },
      );
    }

    const truncated = text.length > MAX_INPUT_LENGTH;
    const input = truncated ? text.slice(0, MAX_INPUT_LENGTH) : text;

    const now = new Date();
    const currentTimeStr = now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const lang = language === "zh" ? "Traditional Chinese" : "English";

    const systemPrompt = `You are a task extraction assistant. Current time: ${currentTimeStr}

Analyze the user's free-form text and extract all actionable tasks/to-dos. Ignore observations, thoughts, and non-actionable content.

Return a JSON array of tasks. Each task:
{
  "title": "Clean, concise task title in ${lang}",
  "dateTime": "ISO format YYYY-MM-DDTHH:mm or null if no date mentioned",
  "priority": "high" | "medium" | "low",
  "tags": ["relevant", "tags"]
}

Rules:
- Extract ONLY actionable items (things to do, schedule, complete, buy, submit, etc.)
- Skip observations, notes, context, thoughts
- Normalize dates relative to current time. "tomorrow" = next day. "next week" = next Monday.
- For ambiguous times (no AM/PM), use PM for hours 1-6
- If no date/time is mentioned, set dateTime to null
- Priority: HIGH for urgent/deadline/ASAP, LOW for whenever/maybe, MEDIUM default
- Tags: infer 1-2 relevant tags per task (e.g., "work", "school", "shopping", "social")
- If no tasks found, return empty array []
- Return ONLY the JSON array, no markdown fences, no explanation`;

    const { text: content } = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: input,
      temperature: 0.2,
      maxTokens: 1000,
    });

    if (!content) {
      return NextResponse.json({
        success: true,
        data: { tasks: [], truncated },
      });
    }

    // Parse JSON from response
    let tasks;
    try {
      let jsonString = content.trim();
      // Strip markdown code fences if present
      const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) jsonString = fenceMatch[1];

      tasks = JSON.parse(jsonString);
      if (!Array.isArray(tasks)) tasks = [];
    } catch {
      console.error("[extract-tasks] JSON parse error:", content);
      tasks = [];
    }

    // Validate and sanitize each task
    const validTasks = tasks
      .filter((t) => t.title && typeof t.title === "string")
      .map((t) => ({
        title: t.title.trim(),
        dateTime: typeof t.dateTime === "string" ? t.dateTime : null,
        priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
        tags: Array.isArray(t.tags)
          ? t.tags.filter((tag) => typeof tag === "string").map((tag) => tag.toLowerCase().trim())
          : [],
      }));

    return NextResponse.json({
      success: true,
      data: { tasks: validTasks, truncated },
    });
  } catch (error) {
    console.error("[extract-tasks] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/extract-tasks/route.js
git commit -m "feat(api): add AI extract-tasks endpoint for inbox"
```

---

### Task 6: NoteEditor — hideTitle + editorRef

**Files:**
- Modify: `components/notes/NoteEditor.js:19` (props), `:35` (editor ref), `:280-337` (conditional render)

- [ ] **Step 1: Add new props and expose editor ref**

In `components/notes/NoteEditor.js`, modify the component signature on line 19:

```javascript
export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange, hideTitle, editorRef }) {
```

After the `useCreateBlockNote` call (after line 44), add:

```javascript
  // Expose editor content to parent via ref callback
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getContent: () => editor.document,
      };
    }
  }, [editor, editorRef]);
```

- [ ] **Step 2: Conditionally render title and icon**

Wrap the icon area (lines 286-314) and the title input (lines 316-322) in a conditional:

```javascript
      {!hideTitle && (
        <>
          {/* Icon area */}
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
        </>
      )}
```

- [ ] **Step 3: Verify notes page still works**

Run: `npm run dev` and open an existing note page. Verify:
- Title input renders normally
- Icon picker works
- Auto-save works
- No console errors

- [ ] **Step 4: Commit**

```bash
git add components/notes/NoteEditor.js
git commit -m "feat(NoteEditor): add hideTitle and editorRef props for inbox reuse"
```

---

### Task 7: Component — InboxTopBar

**Files:**
- Create: `components/inbox/InboxTopBar.js`

- [ ] **Step 1: Write InboxTopBar component**

```javascript
"use client";

import { useTranslations } from "next-intl";
import { Inbox, Download, MoreHorizontal, Loader2 } from "lucide-react";

export default function InboxTopBar({ saveStatus, onExtract, isExtracting }) {
  const t = useTranslations("inbox");

  const getStatusText = () => {
    if (saveStatus === "saving") return t("subtitle");
    if (saveStatus === "saved") return t("completed");
    return null;
  };

  return (
    <div className="notes-topbar">
      <div className="flex items-center gap-1.5 min-w-0">
        <Inbox
          size={14}
          strokeWidth={1.5}
          style={{ color: "var(--text-muted)", flexShrink: 0 }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("title")}
        </span>
      </div>

      <div className="notes-topbar-actions">
        {getStatusText() && (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {getStatusText()}
          </span>
        )}

        <button
          onClick={onExtract}
          disabled={isExtracting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--text-inverted)",
          }}
        >
          {isExtracting ? (
            <Loader2 size={12} strokeWidth={2} className="animate-spin" />
          ) : (
            <Download size={12} strokeWidth={2} />
          )}
          {isExtracting ? t("extracting") : t("extractTasks")}
        </button>

        <button aria-label="Actions" className="p-1 rounded">
          <MoreHorizontal
            size={14}
            strokeWidth={1.5}
            style={{ color: "var(--text-muted)" }}
          />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/InboxTopBar.js
git commit -m "feat: add InboxTopBar component with Extract Tasks button"
```

---

### Task 8: Components — ExtractedTaskCard + ExtractedTasksSection

**Files:**
- Create: `components/inbox/ExtractedTaskCard.js`
- Create: `components/inbox/ExtractedTasksSection.js`

- [ ] **Step 1: Write ExtractedTaskCard**

```javascript
"use client";

import { memo, useState } from "react";
import { Check, X } from "lucide-react";
import { getPriorityConfig } from "@/lib/utils";

const ExtractedTaskCard = memo(function ExtractedTaskCard({
  task,
  onConfirm,
  onDismiss,
}) {
  const [confirming, setConfirming] = useState(false);
  const priorityConfig = getPriorityConfig(task.priority);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(task);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div
        className="w-[18px] h-[18px] rounded-full flex-shrink-0"
        style={{
          border: `2px solid ${priorityConfig?.color || "var(--text-muted)"}`,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {task.title}
        </div>
        <div className="flex gap-1.5 mt-0.5 flex-wrap">
          {task.dateTime && (
            <span className="text-[10px]" style={{ color: "var(--primary)" }}>
              {task.dateTime}
            </span>
          )}
          {task.tags?.map((tag) => (
            <span
              key={tag}
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              #{tag}
            </span>
          ))}
          {task.priority !== "medium" && (
            <span
              className="text-[10px]"
              style={{
                color:
                  task.priority === "high"
                    ? "var(--danger)"
                    : "var(--text-muted)",
              }}
            >
              {task.priority}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-0.5 flex-shrink-0">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--success)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
          aria-label="Confirm"
        >
          <Check size={14} strokeWidth={2} />
        </button>
        <button
          onClick={() => onDismiss(task)}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--danger)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
          aria-label="Dismiss"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
});

export default ExtractedTaskCard;
```

- [ ] **Step 2: Write ExtractedTasksSection**

```javascript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ExtractedTaskCard from "./ExtractedTaskCard";

export default function ExtractedTasksSection({
  tasks,
  onConfirm,
  onConfirmAll,
  onDismiss,
}) {
  const t = useTranslations("inbox");
  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    try {
      await onConfirmAll();
    } finally {
      setConfirmingAll(false);
    }
  };

  if (!tasks || tasks.length === 0) return null;

  return (
    <div
      className="px-4 py-3"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)", letterSpacing: "0.5px" }}
        >
          {t("extractedTasks")}
        </span>
        <button
          onClick={handleConfirmAll}
          disabled={confirmingAll}
          className="px-2 py-0.5 rounded text-[10px] transition-colors disabled:opacity-50"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {t("confirmAll")}
        </button>
      </div>
      <div className="flex flex-direction-column gap-0.5" style={{ flexDirection: "column" }}>
        {tasks.map((task, index) => (
          <ExtractedTaskCard
            key={`${task.title}-${index}`}
            task={task}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/inbox/ExtractedTaskCard.js components/inbox/ExtractedTasksSection.js
git commit -m "feat: add ExtractedTaskCard and ExtractedTasksSection components"
```

---

### Task 9: Page — Inbox Rewrite

**Files:**
- Modify: `app/[locale]/(app)/inbox/page.js` (full rewrite)

- [ ] **Step 1: Rewrite inbox page**

Replace the entire file content:

```javascript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderKeys } from "@/lib/queryKeys";
import { blocksToText } from "@/lib/notes/blocksToText";

import NoteEditor from "@/components/notes/NoteEditor";
import InboxTopBar from "@/components/inbox/InboxTopBar";
import ExtractedTasksSection from "@/components/inbox/ExtractedTasksSection";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("inbox");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [inboxNote, setInboxNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const editorRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Fetch or create inbox note
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const res = await fetch("/api/inbox/note", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          setInboxNote(data.data);
        }
      } catch (err) {
        console.error("Failed to load inbox note:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user]);

  // Save handler for NoteEditor
  const handleSave = useCallback(async (updates) => {
    try {
      const res = await fetch("/api/inbox/note", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!data.success) throw new Error("Save failed");
    } catch (err) {
      throw err;
    }
  }, []);

  // Extract tasks from editor content
  const handleExtract = useCallback(async () => {
    const blocks = editorRef.current?.getContent();
    if (!blocks) return;

    const text = blocksToText(blocks);
    if (!text.trim()) {
      toast.info(t("noTasks"));
      return;
    }

    // Warn if there are unconfirmed tasks
    if (extractedTasks.length > 0) {
      toast.info(t("reExtractWarning"));
    }

    setIsExtracting(true);
    try {
      const res = await fetch("/api/ai/extract-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: locale === "zh-TW" ? "zh" : "en",
        }),
      });
      const data = await res.json();
      if (data.success && data.data.tasks.length > 0) {
        setExtractedTasks(data.data.tasks);
      } else {
        setExtractedTasks([]);
        toast.info(t("noTasks"));
      }
    } catch {
      toast.error("Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  }, [extractedTasks.length, locale, t]);

  // Confirm a single task → create reminder
  const handleConfirm = useCallback(
    async (task) => {
      try {
        const hasDate = !!task.dateTime;
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            dateTime: task.dateTime || null,
            priority: task.priority || "medium",
            tags: task.tags || [],
            inboxState: hasDate ? "processed" : "inbox",
          }),
        });
        if (!res.ok) throw new Error("Failed");
        setExtractedTasks((prev) => prev.filter((t) => t !== task));
        queryClient.invalidateQueries({ queryKey: reminderKeys.all });
        toast.success(t("confirmed"));
      } catch {
        toast.error(t("confirmFailed"));
      }
    },
    [queryClient, t],
  );

  // Confirm all tasks
  const handleConfirmAll = useCallback(async () => {
    let success = 0;
    let failed = 0;
    const remaining = [...extractedTasks];

    for (const task of extractedTasks) {
      try {
        const hasDate = !!task.dateTime;
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            dateTime: task.dateTime || null,
            priority: task.priority || "medium",
            tags: task.tags || [],
            inboxState: hasDate ? "processed" : "inbox",
          }),
        });
        if (!res.ok) throw new Error("Failed");
        success++;
        const idx = remaining.indexOf(task);
        if (idx !== -1) remaining.splice(idx, 1);
      } catch {
        failed++;
      }
    }

    setExtractedTasks(remaining);
    queryClient.invalidateQueries({ queryKey: reminderKeys.all });

    if (failed === 0) {
      toast.success(t("confirmed"));
    } else {
      toast.error(t("partialSuccess", { success, failed }));
    }
  }, [extractedTasks, queryClient, t]);

  // Dismiss a task
  const handleDismiss = useCallback(
    (task) => {
      setExtractedTasks((prev) => prev.filter((t) => t !== task));
      toast(t("dismissed"));
    },
    [t],
  );

  if (status === "loading" || loading) {
    return (
      <div className="flex h-full">
        <section
          className="flex-1 overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-between px-3"
            style={{
              minHeight: 40,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="skeleton-line h-3 w-24" />
            <div className="skeleton-line h-3 w-20" />
          </div>
          <div className="px-6 pt-6">
            <div className="space-y-3" style={{ paddingLeft: 54 }}>
              <div className="skeleton-line h-4 w-full" />
              <div className="skeleton-line h-4 w-5/6" />
              <div className="skeleton-line h-4 w-3/5" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>
      <InboxTopBar
        saveStatus={saveStatus}
        onExtract={handleExtract}
        isExtracting={isExtracting}
      />

      <div className="flex-1 overflow-y-auto">
        {inboxNote && (
          <NoteEditor
            key={inboxNote.id}
            note={inboxNote}
            onSave={handleSave}
            onSaveStatusChange={setSaveStatus}
            hideTitle
            editorRef={editorRef}
          />
        )}

        <ExtractedTasksSection
          tasks={extractedTasks}
          onConfirm={handleConfirm}
          onConfirmAll={handleConfirmAll}
          onDismiss={handleDismiss}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page works**

Run: `npm run dev`, navigate to /inbox.
Expected:
- BlockNote editor renders
- "Extract Tasks" button appears in top bar
- Typing and auto-save works
- Extract Tasks triggers AI call and shows cards below editor

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/inbox/page.js
git commit -m "feat: rewrite inbox page with BlockNote editor and AI task extraction"
```

---

### Task 10: Cleanup — Delete Old Components + Remove Unused i18n Keys

**Files:**
- Delete: `components/inbox/InboxInput.js`
- Delete: `components/inbox/InboxTaskRow.js`
- Delete: `hooks/useInboxTasks.js`
- Modify: `messages/en.json` (remove old inbox keys)
- Modify: `messages/zh-TW.json` (remove old inbox keys)

- [ ] **Step 1: Delete old inbox components**

```bash
rm components/inbox/InboxInput.js components/inbox/InboxTaskRow.js hooks/useInboxTasks.js
```

- [ ] **Step 2: Remove unused i18n keys from en.json**

Remove these keys from the `"inbox"` namespace:
- `subtitle`
- `quickCapture`
- `aiAssistant`
- `emptyTitle`
- `emptyDescription`
- `completed`
- `moreCompleted`
- `reorderFailed`
- `recentLabel`
- `parsing`
- `addFailed`
- `unprocessed`
- `inboxZero`
- `inboxZeroDesc`
- `newTodo`

Keep `title` (still used by InboxTopBar).

- [ ] **Step 3: Remove same keys from zh-TW.json**

Same keys as step 2.

- [ ] **Step 4: Verify no import errors**

Run: `npm run build`
Expected: No build errors. No references to deleted files.

- [ ] **Step 5: Commit**

```bash
git add -u components/inbox/InboxInput.js components/inbox/InboxTaskRow.js hooks/useInboxTasks.js messages/en.json messages/zh-TW.json
git commit -m "chore: delete old inbox components and remove unused i18n keys"
```
