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
- `lib/notes/commands.js` parser is dead code at runtime (only imported by tests)
- Inbox editor exposes AI slash commands that conflict with Extract Tasks

## Design

### 1. Command Detection Flow

All command execution funnels through `executeAiCommand()`. There are two trigger mechanisms:

- **Enter trigger (primary):** user types `/ask hello` and presses Enter → parser detects → calls `executeAiCommand`
- **Menu auto-trigger (convenience, no-input commands only):** Summarize/Digest slash menu items insert the command text and call `executeAiCommand` directly, since there is no prompt to type

Both triggers call the same `executeAiCommand` function. The parser is the gateway for all typed commands; the menu shortcut only bypasses the parser for commands that require no user input.

**On Enter keypress (via ProseMirror `handleKeyDown` plugin):**
1. Check preconditions — all must pass:
   - Block type is `paragraph` (not list item, code block, heading, table)
   - Selection is collapsed (no text selected)
   - `event.isComposing` is false (not in IME composition)
   - Slash menu is not open
   - Block is not in `executedCommands` map (see Consumed Tracking below)
2. Read current block's text content
3. Run through `parseCommand()` from `lib/notes/commands.js`
4. If match:
   - `/ask <prompt>` (with non-empty prompt): intercept Enter, execute AI
   - `/ask` (empty prompt): do nothing, let Enter behave normally
   - `/summarize` / `/digest`: intercept Enter, execute immediately
   - `/summarize <input>` / `/digest <input>`: input is passed to the API (route already supports this)
5. If no match: normal Enter behavior

**Enter handler location:** ProseMirror `handleKeyDown` plugin registered via Tiptap extension. NOT `addKeyboardShortcuts` (which doesn't expose the DOM event, so `isComposing` check is impossible). NOT DOM `capture: true` (avoids event ordering issues with other listeners).

**Stale closure prevention:** The handler accesses `title` and `locale` via refs (`titleRef`, `localeRef`), not closure variables. `useCreateBlockNote` runs once with `deps=[]`, so any handler registered at editor creation time would capture stale values without refs.

**Consumed tracking:** A `Map<blockId, textContent>` (via `useRef`) tracks executed commands. When parser matches a command:
1. Check the map: if `blockId` exists AND `textContent` matches the stored value → skip (already executed with same prompt)
2. If `blockId` exists but `textContent` differs → allow (user edited the prompt, re-execute is intentional)
3. Add `blockId → textContent` to the map **immediately** (before async execution starts), preventing double-trigger from rapid Enter presses during in-flight streaming

### 2. Slash Menu Integration

**Ask AI:**
- `onItemClick`: update the current block (the one the slash menu was triggered from) with text content `/ask ` (trailing space). Use BlockNote's built-in mechanism to replace the slash trigger text, avoiding a residual empty paragraph from `clearQuery()`.
- Move cursor to end of that block
- User types their prompt, presses Enter → parser handles it
- Aliases: `["ask", "ai"]`

**Summarize:**
- `onItemClick`: update the current block with `/summarize` text, then immediately call `executeAiCommand("summarize", "")`
- No Enter needed — executes on click
- Aliases: `["summarize", "summary"]`

**Digest:**
- `onItemClick`: update the current block with `/digest` text, then immediately call `executeAiCommand("digest", "")`
- No Enter needed — executes on click
- Aliases: `["digest"]`

**Empty block handling:** When the slash menu is triggered from an empty paragraph (user types `/` on a blank line), the menu item should update that block in-place rather than inserting a new one below. This prevents orphaned empty paragraphs. When triggered mid-text in a non-empty block, insert a new paragraph after.

Removed aliases: `"question"`, `"overview"` (these were search aliases, not parser grammar, but removing them avoids user confusion when the typed alias doesn't work as a command).

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

- **Network/API failure:** Loading block updates to localized error text (new i18n key `notes.aiError`). Command block untouched.
- **Empty AI response:** Loading block removed silently. No error shown, no blocks inserted.
- **Deleted anchor during streaming:** Every `editor.updateBlock(loadingBlock, ...)` call during streaming is wrapped in try-catch. If the block was deleted by the user mid-stream, catch the error and abort the stream reader silently. The final insert also null-checks both `commandBlock` and `loadingBlock`.
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
- `executedCommands` Map ref for consumed tracking (blockId → textContent)
- Tiptap `handleKeyDown` plugin for Enter interception
- `titleRef` and `localeRef` for stale closure prevention

---

## Files Affected

| File | Changes |
|------|---------|
| `components/notes/NoteEditor.js` | Major rewrite of AI integration: remove pendingAskRef, add Tiptap handleKeyDown plugin, rewrite slash menu items, fix streaming display, add disableAiCommands prop, add resetContent to editorRef, add titleRef/localeRef |
| `lib/notes/commands.js` | No changes needed — already correct. Goes from runtime-dead to active import. |
| `lib/notes/blocksToText.js` | No changes — newly imported by NoteEditor |
| `app/api/ai/notes-agent/route.js` | No changes in this scope |
| `app/[locale]/(notes)/inbox/page.js` | Pass `disableAiCommands={true}` to NoteEditor, migrate from `_editor` to `resetContent` method |
| `messages/en.json` | Add i18n keys: `notes.aiGenerating`, `notes.aiError` |
| `messages/zh-TW.json` | Add i18n keys: `notes.aiGenerating`, `notes.aiError` |
| `tests/unit/notes-commands.test.js` | Already exists — no changes needed |

## Regression Verification

These files are not modified but must be manually tested after the rewrite:

- `app/[locale]/(notes)/notes/[noteId]/page.js` — primary NoteEditor consumer, verify all normal editing still works
- `app/[locale]/(notes)/inbox/page.js` — verify disableAiCommands hides AI items, verify resetContent works, verify Extract Tasks unaffected

New integration tests needed (to be defined in implementation plan):
- Enter handler: typed `/ask`, `/summarize`, `/digest` in various block types
- Slash menu: Ask AI inserts `/ask `, Summarize/Digest auto-execute
- Consumed tracking: re-Enter on executed block, edited prompt re-execution
- disableAiCommands: AI items hidden, Enter handler inactive
- Streaming: mid-stream block deletion, empty response, error response

## Out of Scope

- New commands (rewrite, translate, continue)
- Rate limiting on `/api/ai/notes-agent`
- Language default fix (server defaults to "zh")
- Changes to the API route
- Custom BlockNote block types
