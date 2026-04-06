# Inline AI Redesign — Unified Command Parser

**Date:** 2026-04-06
**Scope:** Fix and unify the inline AI feature in the notes editor (Ask AI, Summarize, Digest)
**Approach:** Remove dual code paths, unify around a single command parser triggered on Enter

---

## Problem

The inline AI feature (slash commands in BlockNote editor) is unintuitive and buggy:

- After selecting "Ask AI" from the slash menu, user sees an empty block with no guidance
- `pendingAskRef` mechanism creates a fragile, separate code path from direct typing
- Streaming displays raw markdown syntax (e.g., `## Heading`, `**bold**`) in italic
- Context extraction skips nested blocks (list children, toggles)
- Keydown handler on outer `<div>` is unreliable with BlockNote's internal Enter handling
- `lib/notes/commands.js` parser is dead code — not imported anywhere
- Inbox editor exposes AI slash commands that conflict with Extract Tasks

## Design

### 1. Command Detection Flow

All command execution converges to a single path: user types a command → presses Enter → parser detects and executes.

**On Enter keypress:**
1. Check preconditions — all must pass:
   - Block type is `paragraph` (not list item, code block, heading, table)
   - Selection is collapsed (no text selected)
   - `event.isComposing` is false (not in IME composition)
   - Slash menu is not open
   - Block ID is not in the `executedCommands` Set
2. Read current block's text content
3. Run through `parseCommand()` from `lib/notes/commands.js`
4. If match:
   - `/ask <prompt>` (with non-empty prompt): intercept Enter, execute AI
   - `/ask` (empty prompt): do nothing, let Enter behave normally
   - `/summarize` / `/digest`: intercept Enter, execute immediately
5. If no match: normal Enter behavior

**Enter handler location:** Tiptap `addKeyboardShortcuts` or `handleKeyDown` plugin, not DOM `capture: true`. This avoids conflict with BlockNote's SuggestionMenu which also registers capture listeners on `editor.domElement`.

**Consumed tracking:** A `Set<blockId>` (via `useRef`) tracks blocks that have already executed a command. When parser matches a command, check the Set first. If already executed, let Enter pass through normally. Add the block ID to the Set after successful execution.

### 2. Slash Menu Integration

**Ask AI:**
- `onItemClick`: insert a new paragraph after current block with text content `/ask ` (trailing space)
- Move cursor to end of that block
- User types their prompt, presses Enter → parser handles it
- Aliases: `["ask", "ai"]`

**Summarize:**
- `onItemClick`: insert `/summarize` text in a new paragraph, then immediately call `executeAiCommand("summarize", "")`
- No Enter needed — executes on click
- Aliases: `["summarize", "summary"]`

**Digest:**
- `onItemClick`: insert `/digest` text in a new paragraph, then immediately call `executeAiCommand("digest", "")`
- No Enter needed — executes on click
- Aliases: `["digest"]`

Removed aliases: `"question"`, `"overview"` (inconsistent with parser grammar).

### 3. Streaming & Display

Three phases:

**Phase 1 — Command Submitted:**
- Command block retains the user's typed text as-is (e.g., `/ask what are the key action items?`)
- A loading block is inserted below with a spinner indicator + "Generating..." text

**Phase 2 — Streaming:**
- Accumulated text is displayed as plain text (markdown syntax stripped for display)
- A blinking cursor indicates generation is in progress
- No italic styling, no raw markdown symbols visible to user

**Phase 3 — Complete:**
- `editor.tryParseMarkdownToBlocks(accumulated)` converts full markdown to proper BlockNote blocks
- Loading block is removed
- Parsed blocks (headings, lists, bold, etc.) are inserted after the command block
- These are normal, editable BlockNote blocks that auto-save with the note

### 4. Context Extraction

Replace inline context extraction in `executeAiCommand` with the existing `blocksToText()` utility from `lib/notes/blocksToText.js`:

```js
// Replace:
const noteContext = blocks
  .map(b => b.content?.map(c => c.text || "").join("") || "")
  .filter(Boolean).join("\n");

// With:
import { blocksToText } from "@/lib/notes/blocksToText";
const noteContext = blocksToText(editor.document);
```

This correctly recurses into `block.children`, capturing list items, toggles, and other nested content.

### 5. Error Handling & Edge Cases

- **Network/API failure:** Loading block updates to `"❌ AI request failed"`. Command block untouched.
- **Empty AI response:** Loading block removed silently. No error shown, no blocks inserted.
- **Deleted anchor block:** Before inserting results, null-check `editor.getBlock(commandBlockId)` and `editor.getBlock(loadingBlockId)`. If either is gone, silently abort.
- **Concurrent commands:** No queue or mutex. Each command operates on its own loading block independently.
- **Inbox editor isolation:** `NoteEditor` accepts a `disableAiCommands` prop. When true: slash menu hides AI items, Enter handler skips command parsing. Inbox page passes `disableAiCommands={true}`.

### 6. Cleanup

**Remove:**
- `pendingAskRef` — the entire ref, all reads/writes, the keydown handler logic that depends on it
- `onKeyDown={handleEditorKeyDown}` on outer `<div>` — Enter handling moves to Tiptap handler
- `editorRef._editor` — replace with a public `resetContent(blocks)` method on the ref object
- Italic purple forced styling on command blocks — command text stays as user typed it
- Italic styling on loading/streaming blocks — use plain text

**Revive:**
- `lib/notes/commands.js` `parseCommand()` — import and use as the single command parser

**Add:**
- `disableAiCommands` prop to `NoteEditor`
- `resetContent` method on `editorRef.current` (for Inbox's reset functionality)
- `executedCommands` Set ref for consumed tracking
- Tiptap keyboard handler registration (via extension or plugin)

---

## Files Affected

| File | Changes |
|------|---------|
| `components/notes/NoteEditor.js` | Major rewrite of AI integration: remove pendingAskRef, add Tiptap handler, rewrite slash menu items, fix streaming display, add disableAiCommands prop, add resetContent to editorRef |
| `lib/notes/commands.js` | No changes needed — already correct. Goes from dead code to active import. |
| `lib/notes/blocksToText.js` | No changes — newly imported by NoteEditor |
| `app/api/ai/notes-agent/route.js` | No changes in this scope |
| `app/[locale]/(notes)/inbox/page.js` | Pass `disableAiCommands={true}` to NoteEditor, migrate from `_editor` to `resetContent` method |
| `tests/unit/notes-commands.test.js` | Already exists with passing tests — no changes needed |

## Out of Scope

- New commands (rewrite, translate, continue)
- Rate limiting on `/api/ai/notes-agent`
- Language default fix (server defaults to "zh")
- Changes to the API route
- Custom BlockNote block types
