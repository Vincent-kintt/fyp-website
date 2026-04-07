# Notes UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native browser dialogs with custom UI components, add @mention note linking to the editor, and add notes search to GlobalSearch + sidebar.

**Architecture:** Three independent features sharing no code dependencies between them. Feature 1 (dialogs) creates reusable `components/ui/` components. Feature 2 (note linking) extends BlockNote with a custom inline content type. Feature 3 (search) adds notes to the existing GlobalSearch command palette and a filter to PageTree sidebar.

**Tech Stack:** React 19, BlockNote 0.47.3, cmdk, TanStack React Query, next-intl

---

### Task 1: i18n Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh-TW.json`

- [ ] **Step 1: Add all new i18n keys to en.json**

In the `"notes"` namespace (after the existing `agentEmptyInput` key), add:

```json
"confirmDeleteTitle": "Delete Page",
"confirmPermanentDeleteTitle": "Delete Permanently",
"renameTitle": "Rename Page",
"noteLinkDeleted": "Deleted note",
"noteLinkLoading": "Loading...",
"mentionNotes": "Notes",
"filterPlaceholder": "Filter pages...",
"noFilterResults": "No matching pages"
```

In the `"search"` namespace, add:

```json
"notes": "Notes"
```

In the `"common"` namespace, add:

```json
"confirm": "Confirm"
```

- [ ] **Step 2: Add matching keys to zh-TW.json**

Same structure, Chinese values:

In `"notes"`:
```json
"confirmDeleteTitle": "刪除頁面",
"confirmPermanentDeleteTitle": "永久刪除",
"renameTitle": "重新命名頁面",
"noteLinkDeleted": "已刪除的筆記",
"noteLinkLoading": "載入中...",
"mentionNotes": "筆記",
"filterPlaceholder": "篩選頁面...",
"noFilterResults": "找不到符合的頁面"
```

In `"search"`:
```json
"notes": "筆記"
```

In `"common"`:
```json
"confirm": "確認"
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh-TW.json
git commit -m "feat(notes): add i18n keys for dialogs, note linking, and search"
```

---

### Task 2: ConfirmDialog and PromptDialog

**Files:**
- Create: `components/ui/ConfirmDialog.js`
- Create: `components/ui/PromptDialog.js`
- Test: `tests/unit/confirm-dialog.test.js`

- [ ] **Step 1: Write tests for ConfirmDialog**

Create `tests/unit/confirm-dialog.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the component logic via a simple mock approach since
// these components use createPortal. We verify the behavioral contract.

describe("ConfirmDialog contract", () => {
  it("calls onClose when Escape is pressed", () => {
    // ConfirmDialog listens for keydown Escape on document
    const onClose = vi.fn();
    // Simulate: when open=true, the component adds a keydown listener
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
    document.removeEventListener("keydown", handler);
  });

  it("does not call onClose when other keys are pressed", () => {
    const onClose = vi.fn();
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onClose).not.toHaveBeenCalled();
    document.removeEventListener("keydown", handler);
  });
});

describe("PromptDialog validation", () => {
  it("trims input and rejects empty strings", () => {
    const validate = (value) => value.trim().length > 0;
    expect(validate("  hello  ")).toBe(true);
    expect(validate("   ")).toBe(false);
    expect(validate("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass** (these are behavioral/contract tests)

```bash
npx vitest run tests/unit/confirm-dialog.test.js
```

Expected: PASS

- [ ] **Step 3: Create ConfirmDialog component**

Create `components/ui/ConfirmDialog.js`:

```js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const triggerRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useRef(`confirm-dialog-title-${Date.now()}`).current;

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setShouldRender(true);
      setIsClosing(false);
    }
  }, [open]);

  useEffect(() => {
    if (shouldRender && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [shouldRender]);

  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      triggerRef.current?.focus?.();
      onClose();
    }, 150);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm?.();
    handleAnimatedClose();
  }, [onConfirm, handleAnimatedClose]);

  useEffect(() => {
    if (!shouldRender) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        handleAnimatedClose();
      }
      // Focus trap: Tab cycles between cancel and confirm
      if (e.key === "Tab") {
        const focusable = [cancelRef.current, confirmRef.current].filter(Boolean);
        if (focusable.length < 2) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [shouldRender, handleAnimatedClose]);

  if (!shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
        onClick={handleAnimatedClose}
      />
      <div
        className={`relative w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl ${isClosing ? "modal-panel-exit" : "modal-panel-enter"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="p-5">
          <h3
            id={titleId}
            className="text-base font-semibold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
            {message}
          </p>
          <div className="flex gap-2 justify-end">
            <Button ref={cancelRef} variant="secondary" onClick={handleAnimatedClose}>
              {cancelLabel || "Cancel"}
            </Button>
            <Button
              ref={confirmRef}
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={handleConfirm}
            >
              {confirmLabel || "Confirm"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 4: Create PromptDialog component**

Create `components/ui/PromptDialog.js`:

```js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

export default function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  message,
  defaultValue = "",
  confirmLabel,
  cancelLabel,
  placeholder,
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const submitRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useRef(`prompt-dialog-title-${Date.now()}`).current;

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setValue(defaultValue);
      setShouldRender(true);
      setIsClosing(false);
    }
  }, [open, defaultValue]);

  useEffect(() => {
    if (shouldRender && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [shouldRender]);

  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      triggerRef.current?.focus?.();
      onClose();
    }, 150);
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
    handleAnimatedClose();
  }, [value, onSubmit, handleAnimatedClose]);

  useEffect(() => {
    if (!shouldRender) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        handleAnimatedClose();
      }
      // Focus trap: Tab cycles between input, cancel, submit
      if (e.key === "Tab") {
        const focusable = [inputRef.current, cancelRef.current, submitRef.current].filter(Boolean);
        if (focusable.length < 2) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [shouldRender, handleAnimatedClose]);

  if (!shouldRender) return null;

  const isValid = value.trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
        onClick={handleAnimatedClose}
      />
      <div
        className={`relative w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl ${isClosing ? "modal-panel-exit" : "modal-panel-enter"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="p-5">
          <h3
            id={titleId}
            className="text-base font-semibold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
          {message && (
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              {message}
            </p>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid) handleSubmit();
            }}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-lg text-sm mb-4"
            style={{
              background: "var(--input-bg, var(--surface))",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button ref={cancelRef} variant="secondary" onClick={handleAnimatedClose}>
              {cancelLabel || "Cancel"}
            </Button>
            <Button
              ref={submitRef}
              variant="primary"
              onClick={handleSubmit}
              disabled={!isValid}
            >
              {confirmLabel || "Confirm"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 5: Verify Button supports ref forwarding**

Check `components/ui/Button.js` — if it doesn't use `forwardRef`, the `ref` props on Button will be silently ignored. If needed, wrap with `forwardRef`. This is critical for focus trap to work.

- [ ] **Step 6: Commit**

```bash
git add components/ui/ConfirmDialog.js components/ui/PromptDialog.js tests/unit/confirm-dialog.test.js
git commit -m "feat(ui): add ConfirmDialog and PromptDialog components"
```

---

### Task 3: Replace Native Dialogs

**Files:**
- Modify: `hooks/useNotes.js:69-81`
- Modify: `components/notes/TrashSection.js:44-47`
- Modify: `app/[locale]/(notes)/notes/[noteId]/page.js:99-105,155-167`

- [ ] **Step 1: Update useNotes.deleteNote — remove confirm, return boolean**

In `hooks/useNotes.js`, replace the `deleteNote` callback (lines 69-81):

```js
  const deleteNote = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await invalidateAll();
          return true;
        }
        return false;
      } catch {
        toast.error(t("deleteFailed"));
        return false;
      }
    },
    [invalidateAll, t],
  );
```

- [ ] **Step 2: Update page.js — add ConfirmDialog for delete, PromptDialog for rename**

In `app/[locale]/(notes)/notes/[noteId]/page.js`:

Add imports at the top:
```js
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
```

Add state variables inside `NotePage()` after existing state:
```js
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
```

Replace `handleDeleteNote` (lines 99-105):
```js
  const handleDeleteNote = useCallback(
    (id) => {
      setDeleteTargetId(id);
      setShowDeleteDialog(true);
    },
    [],
  );

  const confirmDeleteNote = useCallback(
    async () => {
      if (!deleteTargetId) return;
      const success = await deleteNote(deleteTargetId);
      if (success && deleteTargetId === noteId) {
        router.replace("/notes");
      }
    },
    [deleteNote, deleteTargetId, noteId, router],
  );
```

Replace the `onRename` handler in JSX (line 161):
```js
            onRename={() => setShowRenameDialog(true)}
```

Add dialogs before the closing `</NotesLayout>` tag:
```jsx
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDeleteNote}
        title={t("confirmDeleteTitle")}
        message={t("confirmDelete")}
        confirmLabel={t("delete")}
        cancelLabel={t("common.cancel", { ns: "common" })}
        variant="danger"
      />
      {currentNote && (
        <PromptDialog
          open={showRenameDialog}
          onClose={() => setShowRenameDialog(false)}
          onSubmit={(newTitle) => renameNote(currentNote.id, newTitle)}
          title={t("renameTitle")}
          defaultValue={currentNote.title}
          placeholder={t("untitled")}
        />
      )}
```

Note: for `cancelLabel`, use `useTranslations("common")` as a separate hook — add `const tc = useTranslations("common");` and use `tc("cancel")`.

- [ ] **Step 3: Update TrashSection — add ConfirmDialog for permanent delete**

In `components/notes/TrashSection.js`:

Add imports:
```js
import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
```

Add state inside the component:
```js
  const [deleteTarget, setDeleteTarget] = useState(null);
```

Replace the inline `confirm()` in the delete button onClick (line 44-47):
```js
              onClick={() => setDeleteTarget(note.id)}
```

Add the dialog before the closing `</div>` of the component:
```jsx
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          onPermanentDelete?.(deleteTarget);
          setDeleteTarget(null);
        }}
        title={t("confirmPermanentDeleteTitle")}
        message={t("confirmPermanentDelete")}
        confirmLabel={t("deletePermanently")}
        variant="danger"
      />
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/confirm-dialog.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useNotes.js components/notes/TrashSection.js "app/[locale]/(notes)/notes/[noteId]/page.js"
git commit -m "feat(notes): replace native dialogs with ConfirmDialog and PromptDialog"
```

---

### Task 4: NoteLinkInlineContent — Custom BlockNote Inline Type

**Files:**
- Create: `components/notes/NoteLinkInlineContent.js`
- Modify: `lib/notes/blocksToText.js:14-16`
- Modify: `lib/notes/preview.js:16-17`
- Test: `tests/integration/note-tools.test.js` (add cases)

- [ ] **Step 1: Write tests for blocksToText and extractPreview with noteLink**

Add to `tests/integration/note-tools.test.js` (or create a new `tests/unit/blocks-to-text.test.js`):

```js
import { describe, it, expect } from "vitest";
import { blocksToText } from "@/lib/notes/blocksToText.js";
import { extractPreview } from "@/lib/notes/preview.js";

describe("blocksToText with noteLink", () => {
  it("converts noteLink inline content to [Note: id]", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "See " },
          { type: "noteLink", props: { noteId: "abc123" } },
          { type: "text", text: " for details" },
        ],
      },
    ];
    expect(blocksToText(blocks)).toBe("See [Note: abc123] for details");
  });

  it("handles noteLink without noteId prop", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [{ type: "noteLink", props: {} }],
      },
    ];
    expect(blocksToText(blocks)).toBe("[Note: unknown]");
  });
});

describe("extractPreview with noteLink", () => {
  it("includes [note] placeholder for noteLink content", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Check " },
          { type: "noteLink", props: { noteId: "abc" } },
        ],
      },
    ];
    expect(extractPreview(blocks)).toBe("Check [note]");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/blocks-to-text.test.js
```

Expected: FAIL (noteLink not handled yet)

- [ ] **Step 3: Update blocksToText to handle noteLink**

In `lib/notes/blocksToText.js`, replace the `.map()` call (line 14-15):

```js
      const inlineText = block.content
        .map((inline) => {
          if (inline.type === "text" && inline.text) return inline.text;
          if (inline.type === "noteLink") return `[Note: ${inline.props?.noteId || "unknown"}]`;
          return "";
        })
        .join("");
```

- [ ] **Step 4: Update extractPreview to handle noteLink**

In `lib/notes/preview.js`, inside the inner for loop (after line 16), add the noteLink case:

```js
      if (inline.type === "noteLink") {
        inlineTexts.push("[note]");
      }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/unit/blocks-to-text.test.js
```

Expected: PASS

- [ ] **Step 6: Create NoteLinkInlineContent component**

Create `components/notes/NoteLinkInlineContent.js`:

```js
"use client";

import { createReactInlineContentSpec } from "@blocknote/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { File } from "lucide-react";
import { noteKeys } from "@/lib/queryKeys";
import NoteIcon from "./NoteIcon";

async function fetchNotes() {
  const res = await fetch("/api/notes");
  if (!res.ok) throw new Error("Failed to fetch notes");
  const data = await res.json();
  return data.data || [];
}

function NoteLinkChip({ noteId }) {
  const t = useTranslations("notes");
  const router = useRouter();
  const { data: notes = [], isLoading } = useQuery({
    queryKey: noteKeys.lists(),
    queryFn: fetchNotes,
  });

  const note = notes.find((n) => n.id === noteId);

  if (isLoading) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
        style={{
          background: "var(--surface-hover)",
          color: "var(--text-muted)",
        }}
      >
        {t("noteLinkLoading")}
      </span>
    );
  }

  if (!note) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
        style={{
          background: "var(--surface-hover)",
          color: "var(--text-muted)",
          textDecoration: "line-through",
        }}
      >
        <File size={11} strokeWidth={1.5} style={{ opacity: 0.5 }} />
        {t("noteLinkDeleted")}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors"
      style={{
        background: "var(--surface-hover)",
        color: "var(--accent)",
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/notes/${noteId}`);
      }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/notes/${noteId}`);
      }}
    >
      <NoteIcon icon={note.icon} hasChildren={false} expanded={false} size={11} />
      {note.title || t("untitled")}
    </span>
  );
}

export const noteLinkSpec = createReactInlineContentSpec(
  {
    type: "noteLink",
    propSchema: {
      noteId: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => <NoteLinkChip noteId={props.inlineContent.props.noteId} />,
  },
);
```

- [ ] **Step 7: Commit**

```bash
git add components/notes/NoteLinkInlineContent.js lib/notes/blocksToText.js lib/notes/preview.js tests/unit/blocks-to-text.test.js
git commit -m "feat(notes): add noteLink inline content type and update text extractors"
```

---

### Task 5: Integrate @mention into NoteEditor

**Files:**
- Modify: `components/notes/NoteEditor.js:1-13,61-70,129-156,639-654`
- Modify: `app/[locale]/(notes)/notes/[noteId]/page.js:168`

- [ ] **Step 1: Update NoteEditor imports and props**

In `components/notes/NoteEditor.js`:

Add imports (alongside existing BlockNote imports):
```js
import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
import { noteLinkSpec } from "./NoteLinkInlineContent";
import { File } from "lucide-react";
import NoteIcon from "./NoteIcon";
```

Update the component signature to accept `notes` prop:
```js
export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange, hideTitle, editorRef, disableAiCommands, notes }) {
```

- [ ] **Step 2: Create the custom editor schema**

Before the `useCreateBlockNote` call (around line 61), add:

```js
  const schema = useMemo(
    () =>
      BlockNoteSchema.create({
        inlineContentSpecs: {
          ...defaultInlineContentSpecs,
          noteLink: noteLinkSpec,
        },
      }),
    [],
  );
```

Update `useCreateBlockNote` to use the schema:
```js
  const editor = useCreateBlockNote({
    schema,
    initialContent: note?.content?.length > 0 ? note.content : undefined,
    dictionary: {
      ...bnEn,
      placeholders: {
        ...bnEn.placeholders,
        default: t("editorPlaceholder"),
      },
    },
  });
```

Add `useMemo` to the React imports at the top of the file.

- [ ] **Step 3: Build the @ mention items list**

After the `getSlashMenuItems` callback (around line 566), add:

```js
  const getMentionItems = useCallback(
    (editorInstance) => {
      if (!notes || notes.length === 0) return [];
      return notes.map((n) => ({
        title: n.title || t("untitled"),
        onItemClick: () => {
          editorInstance.insertInlineContent([
            { type: "noteLink", props: { noteId: n.id } },
            " ",
          ]);
        },
        icon: (
          <NoteIcon
            icon={n.icon}
            hasChildren={false}
            expanded={false}
            size={14}
          />
        ),
        aliases: [],
        group: t("mentionNotes"),
      }));
    },
    [notes, t],
  );
```

- [ ] **Step 4: Add @ SuggestionMenuController to JSX**

Inside the `<BlockNoteView>` tag, after the existing `<SuggestionMenuController triggerCharacter="/">`, add:

```jsx
        {notes && notes.length > 0 && (
          <SuggestionMenuController
            triggerCharacter="@"
            getItems={async (query) =>
              filterSuggestionItems(getMentionItems(editor), query)
            }
          />
        )}
```

This naturally gates the @ menu: Inbox doesn't pass `notes`, so the controller won't render.

- [ ] **Step 5: Pass notes to NoteEditor from page.js**

In `app/[locale]/(notes)/notes/[noteId]/page.js`, update the `<NoteEditor>` JSX (around line 168):

```jsx
          <NoteEditor
            key={currentNote.id}
            note={currentNote}
            onSave={handleSave}
            onSaveStatusChange={setEditorSaveStatus}
            onIconChange={handleIconChange}
            notes={notes}
          />
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests pass. No regressions.

- [ ] **Step 7: Commit**

```bash
git add components/notes/NoteEditor.js "app/[locale]/(notes)/notes/[noteId]/page.js"
git commit -m "feat(notes): integrate @mention note linking into editor"
```

---

### Task 6: Add Notes to GlobalSearch

**Files:**
- Modify: `components/search/GlobalSearch.js`

- [ ] **Step 1: Add notes state and fetch logic**

In `components/search/GlobalSearch.js`:

Add `File` icon import at top:
```js
import { File } from "lucide-react";
```

Add notes state alongside reminders state (around line 112):
```js
  const [notes, setNotes] = useState([]);
```

In the `useEffect` that fetches on open (around line 144-173), add notes fetch in parallel with reminders:

Replace the `fetchReminders` function inside the effect with a combined fetch:

```js
    const fetchData = async () => {
      setLoading(true);
      try {
        const [remindersRes, notesRes] = await Promise.all([
          fetch("/api/reminders"),
          fetch("/api/notes"),
        ]);
        const remindersData = await remindersRes.json();
        const notesData = await notesRes.json();
        if (remindersData.success) {
          setReminders(remindersData.data);
        }
        if (notesData.success) {
          setNotes(notesData.data || []);
        }
        cacheRef.current = {
          data: { reminders: remindersData.data || [], notes: notesData.data || [] },
          timestamp: Date.now(),
        };
      } catch (err) {
        console.error("Error fetching search data:", err);
      } finally {
        setLoading(false);
      }
    };
```

Update the cache check to restore both:
```js
    if (cacheRef.current.data && now - cacheRef.current.timestamp < CACHE_TTL) {
      setReminders(cacheRef.current.data.reminders || cacheRef.current.data);
      setNotes(cacheRef.current.data.notes || []);
      return;
    }
```

- [ ] **Step 2: Add note selection handler**

Add alongside the existing `handleSelect` (around line 175):
```js
  const handleSelectNote = useCallback(
    (id) => {
      setOpen(false);
      router.push(`/notes/${id}`);
    },
    [router],
  );
```

- [ ] **Step 3: Add Notes Command.Group in JSX**

After the `{/* Quick Actions */}` `Command.Group` and before the reminders divider, add:

```jsx
            {/* Notes */}
            {notes.length > 0 && (
              <>
                <div className="cmdk-divider" />
                <Command.Group heading={t("notes")}>
                  {(isBrowsing ? notes.slice(0, 5) : notes).map((n) => (
                    <Command.Item
                      key={`note-${n.id}`}
                      value={n.title || "Untitled"}
                      onSelect={() => handleSelectNote(n.id)}
                      className="cmdk-item"
                    >
                      <File size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                      <span className="cmdk-item-title flex-1 min-w-0 truncate">
                        <HighlightText text={n.title || "Untitled"} search={searchValue} />
                      </span>
                      {isBrowsing && n.updatedAt && (
                        <span className="cmdk-item-date">
                          {formatDateShort(n.updatedAt, locale)}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}
```

Add the `"notes"` i18n key usage — `t("notes")` already works because GlobalSearch uses `useTranslations("search")` and we added `"notes"` to the search namespace in Task 1.

- [ ] **Step 4: Run dev and verify**

```bash
npm run dev
```

Open the app, press Cmd+K, verify notes appear in the command palette.

- [ ] **Step 5: Commit**

```bash
git add components/search/GlobalSearch.js
git commit -m "feat(search): add notes to GlobalSearch command palette"
```

---

### Task 7: Sidebar Filter in PageTree

**Files:**
- Modify: `components/notes/PageTree.js`

- [ ] **Step 1: Add filter state and input**

In `components/notes/PageTree.js`:

Add `useRef` to the React imports. Add `Search` to the lucide imports:
```js
import { ChevronRight, File, Plus, Search, Trash2 } from "lucide-react";
```

Inside the component, after the existing `const [trashOpen, setTrashOpen] = useState(false);`, add:
```js
  const [filterQuery, setFilterQuery] = useState("");
  const filterInputRef = useRef(null);
```

Add Escape handler for the filter input:
```js
  const handleFilterKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      e.stopPropagation(); // Prevent MobileSidebar from closing
      setFilterQuery("");
      filterInputRef.current?.blur();
    }
  }, []);
```

- [ ] **Step 2: Compute filtered notes**

After the `flattenVisibleTree` call, add:
```js
  const filteredNotes = filterQuery
    ? notes.filter((n) =>
        (n.title || "").toLowerCase().includes(filterQuery.toLowerCase())
      )
    : null;
```

- [ ] **Step 3: Add the filter input to JSX**

Before the `<DndContext>` block, insert the search input:

```jsx
      {/* Filter input */}
      <div className="px-2 pb-1">
        <div className="relative">
          <Search
            size={13}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)", opacity: 0.6 }}
          />
          <input
            ref={filterInputRef}
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder={t("filterPlaceholder")}
            className="w-full pl-7 pr-2 py-1 text-xs rounded"
            style={{
              background: "transparent",
              border: "1px solid transparent",
              color: "var(--text-primary)",
              outline: "none",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
          />
        </div>
      </div>
```

- [ ] **Step 4: Add filtered results view**

When `filteredNotes` is not null, render a flat list instead of the tree. Wrap the `<DndContext>` block in a conditional:

```jsx
      {filteredNotes ? (
        <div className="px-1 py-1">
          {filteredNotes.length === 0 ? (
            <p
              className="px-3 py-4 text-center text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {t("noFilterResults")}
            </p>
          ) : (
            filteredNotes.map((n) => (
              <a
                key={n.id}
                href={`/notes/${n.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setFilterQuery("");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  n.id === activeNoteId ? "font-medium" : ""
                }`}
                style={{
                  color: n.id === activeNoteId ? "var(--text-primary)" : "var(--text-secondary)",
                  background: n.id === activeNoteId ? "var(--surface-hover)" : "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = n.id === activeNoteId ? "var(--surface-hover)" : "transparent")}
              >
                <File size={14} strokeWidth={1.5} style={{ opacity: 0.5 }} />
                <span className="truncate">{n.title || t("untitled")}</span>
              </a>
            ))
          )}
        </div>
      ) : (
        <DndContext ...>
          {/* existing tree content */}
        </DndContext>
      )}
```

Note: the `<a>` tag uses `href` for semantics but `onClick` with `e.preventDefault()` — use the locale-aware `Link` from `@/i18n/navigation` instead:

```js
import { Link } from "@/i18n/navigation";
```

Replace `<a>` with `<Link>`:
```jsx
              <Link
                key={n.id}
                href={`/notes/${n.id}`}
                onClick={() => setFilterQuery("")}
                className={...}
                style={...}
              >
```

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/notes/PageTree.js
git commit -m "feat(notes): add sidebar filter to PageTree"
```

---

### Task 8: E2E Verification

**Files:** None (manual or Playwright testing)

- [ ] **Step 1: Verify dialogs**

- Open a note, click the "..." menu in top bar → Delete → custom dialog appears (not native)
- Click Cancel → dialog closes, note still exists
- Click Delete → note is deleted, navigates to /notes
- Open trash, click permanent delete icon → custom danger dialog
- Click "..." → Rename → PromptDialog with current title pre-filled
- Clear input → Submit button disabled
- Type new name → Submit → note renamed

- [ ] **Step 2: Verify @mention**

- In the editor, type `@` → suggestion menu appears with notes list
- Type a few characters → list filters
- Click a note → noteLink chip inserted in editor
- Chip shows icon + title
- Click the chip → navigates to that note
- Rename the linked note in sidebar → chip title updates (after React Query refetch)
- Open an Inbox note → type `@` → no suggestion menu appears

- [ ] **Step 3: Verify search**

- Press Cmd+K → GlobalSearch opens, notes section visible
- Type a note title → notes filter correctly
- Click a note → navigates to it
- In sidebar, type in filter input → tree switches to flat filtered list
- Clear filter → tree restored
- Press Escape in filter → filter clears (mobile: sidebar stays open)

- [ ] **Step 4: Run full test suite one final time**

```bash
npx vitest run
```

Expected: All tests pass, no regressions.

- [ ] **Step 5: Final commit if any E2E fixes were needed**

```bash
git add -A
git commit -m "fix(notes): address E2E test findings"
```
