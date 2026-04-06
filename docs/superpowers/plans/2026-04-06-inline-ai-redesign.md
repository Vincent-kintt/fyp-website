# Inline AI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the notes editor's inline AI to use a unified command parser, fixing all UX and reliability bugs.

**Architecture:** Remove `pendingAskRef` dual-path mechanism. All typed commands (`/ask`, `/summarize`, `/digest`) are detected by `parseCommand()` on Enter via a ProseMirror `handleKeyDown` plugin. Slash menu items for no-input commands (Summarize, Digest) call `executeAiCommand` directly as a convenience shortcut. Streaming display strips markdown during generation, then converts to proper BlockNote blocks on completion.

**Tech Stack:** BlockNote 0.47.3, ProseMirror Plugin via `@tiptap/pm/state`, Vercel AI SDK streaming

**Spec:** `docs/superpowers/specs/2026-04-06-inline-ai-redesign.md`

---

## File Structure

- `components/notes/NoteEditor.js` — Major rewrite: remove old AI code, add new unified system
- `lib/notes/commands.js` — No changes (already correct parser, goes from dead to active)
- `lib/notes/blocksToText.js` — No changes (newly imported by NoteEditor)
- `app/[locale]/(notes)/inbox/page.js` — Add `disableAiCommands`, migrate `_editor` to `resetContent`
- `messages/en.json` — Add `aiGenerating`, `aiError` keys to `notes` namespace
- `messages/zh-TW.json` — Add `aiGenerating`, `aiError` keys to `notes` namespace
- `tests/integration/notes-inline-ai.test.js` — New: integration tests for command detection and consumed tracking

---

### Task 1: Add i18n Keys

**Files:**
- Modify: `messages/en.json:288-334` (notes namespace)
- Modify: `messages/zh-TW.json:288-334` (notes namespace)

- [ ] **Step 1: Add English i18n keys**

In `messages/en.json`, inside the `"notes"` object, after the `"resizeSidebar"` key (line 333), add:

```json
    "aiGenerating": "Generating...",
    "aiError": "Failed to get AI response."
```

- [ ] **Step 2: Add Chinese i18n keys**

In `messages/zh-TW.json`, inside the `"notes"` object, after the `"resizeSidebar"` key (line 333), add:

```json
    "aiGenerating": "生成中...",
    "aiError": "AI 回應失敗。"
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh-TW.json
git commit -m "feat(notes): add i18n keys for inline AI generating and error states"
```

---

### Task 2: Strip Old AI Code from NoteEditor

Remove the entire old AI mechanism. After this task, the AI slash menu items and Enter handler will be gone — the editor is temporarily AI-less. This is intentional: clean slate before adding the new system.

**Files:**
- Modify: `components/notes/NoteEditor.js`

- [ ] **Step 1: Remove pendingAskRef and handleEditorKeyDown**

Remove these pieces from `NoteEditor.js`:

1. The `pendingAskRef` declaration (line 28): `const pendingAskRef = useRef(null);`
2. The entire `handleEditorKeyDown` callback (lines 229–262)
3. The `onKeyDown={handleEditorKeyDown}` prop on the outer `<div>` (line 293) — keep the div, just remove the prop

- [ ] **Step 2: Remove old executeAiCommand**

Remove the entire `executeAiCommand` callback (lines 78–178).

- [ ] **Step 3: Remove old AI slash menu items**

In `getSlashMenuItems` (lines 180–227), remove the entire `aiItems` array and the spread `...aiItems`. The function should return only `defaultItems`:

```js
const getSlashMenuItems = useCallback(
  (editorInstance) => {
    return getDefaultReactSlashMenuItems(editorInstance);
  },
  [],
);
```

- [ ] **Step 4: Remove unused imports**

Remove the `Sparkles` import (line 15): `import { Sparkles } from "lucide-react";`

- [ ] **Step 5: Verify editor still works**

```bash
npm run dev
```

Open a note in the browser. Verify: typing works, slash menu shows default items (no AI items), Enter creates new lines normally. The editor is now AI-less but fully functional for normal editing.

- [ ] **Step 6: Commit**

```bash
git add components/notes/NoteEditor.js
git commit -m "refactor(notes): strip old inline AI mechanism from NoteEditor

Remove pendingAskRef, handleEditorKeyDown, executeAiCommand, and AI
slash menu items. Clean slate for unified command parser implementation."
```

---

### Task 3: Implement Unified Command Parser Enter Handler

Add the ProseMirror `handleKeyDown` plugin that detects `/ask`, `/summarize`, `/digest` on Enter and calls `executeAiCommand`.

**Files:**
- Modify: `components/notes/NoteEditor.js`
- Reference: `lib/notes/commands.js` (imported, not modified)
- Reference: `lib/notes/blocksToText.js` (imported, not modified)

- [ ] **Step 1: Add new imports**

At the top of `NoteEditor.js`, add these imports:

```js
import { SuggestionMenu } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { parseCommand } from "@/lib/notes/commands.js";
import { blocksToText } from "@/lib/notes/blocksToText.js";
```

Note: `Plugin` and `PluginKey` come from `@tiptap/pm/state` (Tiptap's ProseMirror re-export, already installed as a transitive dependency of BlockNote). `SuggestionMenu` is exported from `@blocknote/core` extensions.

- [ ] **Step 2: Add refs for stale closure prevention and consumed tracking**

Inside the `NoteEditor` component, after the existing refs, add:

```js
const titleRef = useRef(title);
const localeRef = useRef(locale);
const executedCommandsRef = useRef(new Map());
const executeAiCommandRef = useRef(null);
```

In the existing `useEffect` that resets on `note?.id` change (the one with `setTitle(note?.title || "")` and `setSaveStatus(null)`), add `executedCommandsRef.current.clear()` to reset consumed tracking when switching notes.

Add effects to keep `titleRef` and `localeRef` in sync. **Important:** the `executeAiCommandRef` sync effect is added in Step 4 below, AFTER the `executeAiCommand` declaration — placing it here would cause a TDZ error since `const` declarations are not hoisted.

```js
useEffect(() => { titleRef.current = title; }, [title]);
useEffect(() => { localeRef.current = locale; }, [locale]);
// executeAiCommandRef sync effect goes AFTER executeAiCommand declaration — see Step 4
```

- [ ] **Step 3: Add the `disableAiCommands` prop**

Update the component signature:

```js
export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange, hideTitle, editorRef, disableAiCommands }) {
```

- [ ] **Step 4: Implement executeAiCommand**

Add the new `executeAiCommand` after the refs. This version uses `blocksToText` for context extraction, plain-text streaming with try-catch on each `updateBlock`, and localized status text:

```js
const executeAiCommand = useCallback(
  async (type, input, commandBlockId) => {
    const noteContext = blocksToText(editor.document);
    let commandBlock;

    if (commandBlockId) {
      commandBlock = editor.getBlock(commandBlockId);
    } else {
      const currentBlock = editor.getTextCursorPosition().block;
      commandBlock = currentBlock;
    }

    if (!commandBlock) return;

    // Mark as executed immediately to prevent double-trigger
    const blockText = commandBlock.content?.map((c) => c.text || "").join("") || "";
    executedCommandsRef.current.set(commandBlock.id, blockText);

    const [loadingBlock] = editor.insertBlocks(
      [
        {
          type: "paragraph",
          content: `⏳ ${t("aiGenerating")}`,
        },
      ],
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
          noteTitle: titleRef.current,
          noteContext,
          language: localeRef.current?.startsWith("zh") ? "zh" : "en",
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
        // Strip markdown syntax for display during streaming
        const displayText = accumulated
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/^[-*+]\s+/gm, "— ");
        try {
          editor.updateBlock(loadingBlock, {
            type: "paragraph",
            content: displayText,
          });
        } catch {
          // Block was deleted by user mid-stream — abort
          reader.cancel();
          return;
        }
      }

      // Convert full markdown to proper BlockNote blocks
      if (accumulated.trim()) {
        const parsedBlocks = editor.tryParseMarkdownToBlocks(accumulated);
        if (editor.getBlock(loadingBlock.id)) {
          editor.removeBlocks([loadingBlock]);
        }
        if (parsedBlocks.length > 0 && editor.getBlock(commandBlock.id)) {
          editor.insertBlocks(parsedBlocks, commandBlock, "after");
        }
      } else {
        // Empty response — just remove loading block
        if (editor.getBlock(loadingBlock.id)) {
          editor.removeBlocks([loadingBlock]);
        }
      }
    } catch {
      try {
        editor.updateBlock(loadingBlock, {
          type: "paragraph",
          content: `❌ ${t("aiError")}`,
        });
      } catch {
        // Loading block already deleted
      }
    }
  },
  [editor, t],
);

// Sync executeAiCommandRef AFTER the declaration to avoid TDZ
useEffect(() => { executeAiCommandRef.current = executeAiCommand; }, [executeAiCommand]);
```

- [ ] **Step 5: Register ProseMirror handleKeyDown plugin**

Add this `useEffect` after `executeAiCommand`. It registers a ProseMirror plugin on the editor's Tiptap instance to intercept Enter:

```js
useEffect(() => {
  if (disableAiCommands) return;

  const tiptap = editor._tiptapEditor;
  if (!tiptap) return;

  const pluginKey = new PluginKey("inline-ai-commands");

  const plugin = new Plugin({
    key: pluginKey,
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
          return false;
        }

        // Don't intercept if suggestion menu is open
        if (editor.getExtension(SuggestionMenu)?.shown()) {
          return false;
        }

        const pos = editor.getTextCursorPosition();
        const block = pos.block;

        // Only intercept paragraph blocks
        if (block.type !== "paragraph") return false;

        // Check selection is collapsed
        const { from, to } = view.state.selection;
        if (from !== to) return false;

        // Read block text
        const blockText = block.content?.map((c) => c.text || "").join("") || "";
        const parsed = parseCommand(blockText);
        if (!parsed) return false;

        // /ask with empty prompt — let Enter pass through
        if (parsed.type === "ask" && !parsed.input) return false;

        // Check consumed tracking
        const prevText = executedCommandsRef.current.get(block.id);
        if (prevText !== undefined && prevText === blockText) return false;

        // Execute the command via ref (avoids stale closure)
        event.preventDefault();
        executeAiCommandRef.current(parsed.type, parsed.input, block.id);
        return true;
      },
    },
  });

  // Prepend plugin so it runs BEFORE BlockNote's KeyboardShortcutsExtension
  // which handles Enter for block splitting. Without prepend, BlockNote's
  // handler returns true first and our plugin never fires.
  tiptap.registerPlugin(plugin, (newPlugin, plugins) => [newPlugin, ...plugins]);

  return () => {
    tiptap.unregisterPlugin(pluginKey);
  };
}, [editor, disableAiCommands]);
```

Note: the plugin reads `executeAiCommandRef.current` (not a closure over `executeAiCommand`) so the plugin doesn't need to be re-registered when `executeAiCommand` changes. The effect only depends on `editor` (stable) and `disableAiCommands`. The prepend strategy via `registerPlugin`'s second argument ensures our `handleKeyDown` runs before BlockNote's default Enter handler.

- [ ] **Step 6: Verify typed commands work**

```bash
npm run dev
```

Open a note. Type `/ask what is this note about?` and press Enter. Verify:
1. Enter is intercepted (no new line created)
2. Loading indicator appears below the command line
3. Streaming text appears (markdown stripped)
4. Final result is proper BlockNote blocks (headings, lists, etc.)

Type `/summarize` and press Enter. Verify it executes immediately.

Type regular text and press Enter. Verify normal newline behavior.

- [ ] **Step 7: Commit**

```bash
git add components/notes/NoteEditor.js
git commit -m "feat(notes): add unified command parser with ProseMirror handleKeyDown

Register a ProseMirror plugin that intercepts Enter on /ask, /summarize,
/digest commands. Uses parseCommand() from lib/notes/commands.js, plain-text
streaming display, blocksToText for context extraction, and consumed
tracking via Map to prevent double-trigger."
```

---

### Task 4: Rewrite Slash Menu AI Items

Add back the AI items to the slash menu with the new behavior: Ask AI inserts `/ask ` text for the user to type after; Summarize/Digest insert command text and auto-execute.

**Files:**
- Modify: `components/notes/NoteEditor.js`

- [ ] **Step 1: Re-add Sparkles import**

```js
import { Sparkles } from "lucide-react";
```

- [ ] **Step 2: Rewrite getSlashMenuItems with new AI items**

Replace the `getSlashMenuItems` callback:

```js
const getSlashMenuItems = useCallback(
  (editorInstance) => {
    const defaultItems = getDefaultReactSlashMenuItems(editorInstance);

    if (disableAiCommands) return defaultItems;

    const aiItems = [
      {
        title: t("askAi"),
        onItemClick: () => {
          // After slash menu closes and clearQuery() runs, the block may
          // still have residual text. Use insertOrUpdateBlock pattern:
          // if the block is empty (just had "/"), update in-place;
          // otherwise insert a new block after.
          const currentBlock = editorInstance.getTextCursorPosition().block;
          const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
          if (!blockText.trim()) {
            // Empty block — update in place
            editorInstance.updateBlock(currentBlock, {
              type: "paragraph",
              content: "/ask ",
            });
            editorInstance.setTextCursorPosition(currentBlock, "end");
          } else {
            // Non-empty block — insert new block after
            const [newBlock] = editorInstance.insertBlocks(
              [{ type: "paragraph", content: "/ask " }],
              currentBlock,
              "after",
            );
            editorInstance.setTextCursorPosition(newBlock, "end");
          }
        },
        subtext: t("askAiSubtext"),
        aliases: ["ask", "ai"],
        group: "AI",
        icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
      },
      {
        title: t("summarize"),
        onItemClick: () => {
          const currentBlock = editorInstance.getTextCursorPosition().block;
          const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
          if (!blockText.trim()) {
            editorInstance.updateBlock(currentBlock, {
              type: "paragraph",
              content: "/summarize",
            });
            executeAiCommand("summarize", "", currentBlock.id);
          } else {
            const [newBlock] = editorInstance.insertBlocks(
              [{ type: "paragraph", content: "/summarize" }],
              currentBlock,
              "after",
            );
            executeAiCommand("summarize", "", newBlock.id);
          }
        },
        subtext: t("summarizeSubtext"),
        aliases: ["summarize", "summary"],
        group: "AI",
        icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
      },
      {
        title: t("digestLabel"),
        onItemClick: () => {
          const currentBlock = editorInstance.getTextCursorPosition().block;
          const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
          if (!blockText.trim()) {
            editorInstance.updateBlock(currentBlock, {
              type: "paragraph",
              content: "/digest",
            });
            executeAiCommand("digest", "", currentBlock.id);
          } else {
            const [newBlock] = editorInstance.insertBlocks(
              [{ type: "paragraph", content: "/digest" }],
              currentBlock,
              "after",
            );
            executeAiCommand("digest", "", newBlock.id);
          }
        },
        subtext: t("digestSubtext"),
        aliases: ["digest"],
        group: "AI",
        icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
      },
    ];

    return [...defaultItems, ...aiItems];
  },
  [executeAiCommand, t, disableAiCommands],
);
```

- [ ] **Step 3: Verify slash menu flow**

```bash
npm run dev
```

1. Open a note, type `/` → slash menu opens
2. Type "ask" → Ask AI item appears
3. Click it → current block becomes `/ask ` with cursor at end
4. Type `hello` → block shows `/ask hello`
5. Press Enter → AI executes

Test Summarize: type `/` → select Summarize → block shows `/summarize` → AI executes immediately.

- [ ] **Step 4: Commit**

```bash
git add components/notes/NoteEditor.js
git commit -m "feat(notes): rewrite slash menu AI items for unified command flow

Ask AI inserts '/ask ' text and lets user type prompt. Summarize and
Digest insert command text and auto-execute. All items hidden when
disableAiCommands prop is true."
```

---

### Task 5: Fix editorRef and Inbox Integration

Replace `_editor` with `resetContent` method and pass `disableAiCommands` to Inbox.

**Files:**
- Modify: `components/notes/NoteEditor.js:57-64`
- Modify: `app/[locale]/(notes)/inbox/page.js:222-243,286-292`

- [ ] **Step 1: Update editorRef in NoteEditor**

Replace the existing `editorRef` effect (lines 57-64) with:

```js
useEffect(() => {
  if (editorRef) {
    editorRef.current = {
      getContent: () => editor.document,
      resetContent: (blocks) => {
        const newContent = blocks?.length ? blocks : [{ type: "paragraph", content: [] }];
        editor.replaceBlocks(editor.document, newContent);
      },
    };
  }
}, [editor, editorRef]);
```

- [ ] **Step 2: Update Inbox handleResetInbox**

In `app/[locale]/(notes)/inbox/page.js`, replace the `handleResetInbox` callback (lines 222-243):

```js
const handleResetInbox = useCallback(async () => {
  const editorApi = editorRef.current;
  if (editorApi) {
    editorApi.resetContent();
  }
  setExtractedTasks([]);
  setConfirmedTasks([]);
  try {
    await fetch("/api/inbox/note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: [], extractedTasks: [], confirmedTasks: [] }),
    });
  } catch {}
}, []);
```

- [ ] **Step 3: Pass disableAiCommands to NoteEditor in Inbox**

In the Inbox JSX (around line 286), add the prop:

```jsx
<NoteEditor
  key={inboxNote.id}
  note={inboxNote}
  onSave={handleSave}
  onSaveStatusChange={setSaveStatus}
  editorRef={editorRef}
  disableAiCommands
/>
```

- [ ] **Step 4: Verify Inbox**

```bash
npm run dev
```

1. Open Inbox page
2. Verify slash menu does NOT show AI items (Ask AI, Summarize, Digest)
3. Type `/ask hello` and press Enter → normal newline, no AI trigger
4. Test Extract Tasks still works
5. Test Reset Inbox clears editor content

- [ ] **Step 5: Commit**

```bash
git add components/notes/NoteEditor.js "app/[locale]/(notes)/inbox/page.js"
git commit -m "feat(notes): add resetContent to editorRef, disable AI commands in Inbox

Replace _editor private API access with public resetContent method.
Pass disableAiCommands to NoteEditor in Inbox to prevent AI slash
commands from conflicting with Extract Tasks."
```

---

### Task 6: Integration Tests for Command Detection

Test the core parser integration, consumed tracking, and preconditions. These tests validate the logic without needing a full browser — they test `parseCommand` behavior and the consumed tracking Map logic.

**Files:**
- Create: `tests/integration/notes-inline-ai.test.js`

- [ ] **Step 1: Write integration tests**

```js
// tests/integration/notes-inline-ai.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { parseCommand } from "@/lib/notes/commands.js";

describe("Inline AI command detection", () => {
  describe("parseCommand integration", () => {
    it("detects /ask with prompt", () => {
      const result = parseCommand("/ask what are the action items?");
      expect(result).toEqual({ type: "ask", input: "what are the action items?" });
    });

    it("detects /ask with empty prompt", () => {
      const result = parseCommand("/ask");
      expect(result).toEqual({ type: "ask", input: "" });
    });

    it("detects /ask with only spaces after", () => {
      const result = parseCommand("/ask   ");
      expect(result).toEqual({ type: "ask", input: "" });
    });

    it("detects /summarize without input", () => {
      const result = parseCommand("/summarize");
      expect(result).toEqual({ type: "summarize", input: "" });
    });

    it("detects /summarize with input", () => {
      const result = parseCommand("/summarize the first section");
      expect(result).toEqual({ type: "summarize", input: "the first section" });
    });

    it("detects /digest without input", () => {
      const result = parseCommand("/digest");
      expect(result).toEqual({ type: "digest", input: "" });
    });

    it("ignores text that starts with / but is not a command", () => {
      expect(parseCommand("/unknown hello")).toBeNull();
      expect(parseCommand("/rewrite this")).toBeNull();
      expect(parseCommand("/translate to english")).toBeNull();
    });

    it("ignores regular text", () => {
      expect(parseCommand("hello world")).toBeNull();
      expect(parseCommand("this is /ask embedded")).toBeNull();
      expect(parseCommand("")).toBeNull();
    });

    it("handles leading/trailing whitespace", () => {
      const result = parseCommand("  /ask  hello  ");
      expect(result).toEqual({ type: "ask", input: "hello" });
    });
  });

  describe("consumed tracking Map logic", () => {
    let executedCommands;

    beforeEach(() => {
      executedCommands = new Map();
    });

    it("allows first execution of a command", () => {
      const blockId = "block-1";
      const blockText = "/ask what is this?";
      const prevText = executedCommands.get(blockId);

      expect(prevText).toBeUndefined();
      // Should proceed — not in map
      executedCommands.set(blockId, blockText);
      expect(executedCommands.get(blockId)).toBe(blockText);
    });

    it("blocks re-execution with same text", () => {
      const blockId = "block-1";
      const blockText = "/ask what is this?";
      executedCommands.set(blockId, blockText);

      const prevText = executedCommands.get(blockId);
      const shouldSkip = prevText !== undefined && prevText === blockText;
      expect(shouldSkip).toBe(true);
    });

    it("allows re-execution when prompt is edited", () => {
      const blockId = "block-1";
      executedCommands.set(blockId, "/ask what is this?");

      const newText = "/ask what are the key points?";
      const prevText = executedCommands.get(blockId);
      const shouldSkip = prevText !== undefined && prevText === newText;
      expect(shouldSkip).toBe(false);
    });

    it("tracks multiple blocks independently", () => {
      executedCommands.set("block-1", "/ask hello");
      executedCommands.set("block-2", "/summarize");

      expect(executedCommands.get("block-1")).toBe("/ask hello");
      expect(executedCommands.get("block-2")).toBe("/summarize");
      expect(executedCommands.has("block-3")).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm run test -- tests/integration/notes-inline-ai.test.js
```

Expected: All tests pass. The parser tests validate the exact behavior the Enter handler depends on. The consumed tracking tests validate the Map logic used to prevent double-trigger.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/notes-inline-ai.test.js
git commit -m "test(notes): add integration tests for inline AI command detection

Test parseCommand edge cases and consumed tracking Map logic that
prevents double-trigger and allows re-execution on edited prompts."
```

---

### Task 7: Manual Regression Verification

No code changes. Verify the complete feature works end-to-end and existing functionality is not broken.

- [ ] **Step 1: Run existing test suite**

```bash
npm run test
```

Expected: All 287+ tests pass. No regressions.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 3: Manual E2E verification checklist**

Open the app in browser (`npm run dev`):

**Normal editing (notes/[noteId] page):**
- [ ] Type regular text, press Enter → normal newline
- [ ] Create lists, headings, code blocks → all work normally
- [ ] Slash menu opens on `/`, default items work (heading, list, etc.)

**Typed commands:**
- [ ] Type `/ask what is this about?` + Enter → AI executes, streaming appears, final blocks are proper markdown
- [ ] Type `/summarize` + Enter → AI summarizes the note
- [ ] Type `/digest` + Enter → AI generates digest
- [ ] Type `/ask` + Enter (empty prompt) → normal newline, no AI trigger
- [ ] Type `/unknown something` + Enter → normal newline, no AI trigger
- [ ] Type `/ask hello`, execute, then put cursor back on same line, press Enter → does NOT re-execute (consumed)
- [ ] Edit that line to `/ask different question` + Enter → DOES re-execute (edited prompt)

**Slash menu AI items:**
- [ ] Type `/`, select Ask AI → block becomes `/ask `, cursor at end, type prompt + Enter → AI executes
- [ ] Type `/`, select Summarize → block becomes `/summarize`, AI auto-executes
- [ ] Type `/`, select Digest → block becomes `/digest`, AI auto-executes

**Inbox page:**
- [ ] Slash menu does NOT show AI items
- [ ] Typing `/ask hello` + Enter → normal newline
- [ ] Extract Tasks still works
- [ ] Reset Inbox clears content

**Edge cases:**
- [ ] In a list item, type `/ask hello` + Enter → normal list behavior, no AI trigger
- [ ] In a code block, type `/ask hello` + Enter → normal code block behavior
- [ ] IME composition (Chinese/Japanese input) → Enter during composition does not trigger AI
- [ ] Delete the loading block mid-stream → no crash, stream aborts silently
