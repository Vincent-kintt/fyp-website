# Navigation Phase 2c — Inline AI Task Detection

## Summary

Add real-time AI task detection to the desktop Inbox editor. As users type in the BlockNote editor, the system detects actionable phrases, highlights them with ephemeral decorations, and shows a floating suggestion panel to convert text into tasks.

## Prerequisites

Phase 2b complete: desktop InboxEditor with BlockNote, capture document API, useMediaQuery hook. Branch `UI-design`.

---

## Feature Overview

User types freely in the Inbox editor. After a 1200ms typing pause, the last-modified paragraph is sent to an extended parse-task API. If a task is detected with sufficient confidence, the relevant phrase gets a subtle visual highlight and a floating panel appears offering to create the task.

---

## Part 1: parse-task API Extension

### Current State

`/api/ai/parse-task` accepts `{ text, language }` and returns:
```json
{
  "success": true,
  "data": {
    "title": "Clean task title",
    "tags": ["tag1"],
    "priority": "medium",
    "dateTime": "2026-04-08T14:00",
    "confidence": {
      "title": 0.9,
      "tags": 0.8,
      "priority": 0.7,
      "dateTime": 0.95
    }
  }
}
```

### Problem

The API always returns a parsed task, even for non-task text like "the weather is nice today." There's no way to distinguish "this is definitely a task" from "I made my best guess." The confidence values are mostly static (title always 0.9, priority always 0.7) — not truly dynamic.

### Extended Response

Add three fields to the response (backward compatible — existing consumers ignore unknown fields):

```json
{
  "success": true,
  "data": {
    "title": "Meeting with Prof. Lee",
    "tags": ["work"],
    "priority": "medium",
    "dateTime": "2026-04-08T14:00",
    "isTask": true,
    "matchedText": "meeting with Prof. Lee next Tuesday at 2pm",
    "confidence": {
      "title": 0.9,
      "tags": 0.8,
      "priority": 0.7,
      "dateTime": 0.95,
      "overall": 0.88
    }
  }
}
```

New fields:
- `isTask` (boolean): LLM explicitly determines if the input contains an actionable task. Non-task text (observations, notes, feelings) returns `false`.
- `matchedText` (string): The exact substring from the input that the LLM identified as the task. Used for highlighting in the editor.
- `confidence.overall` (number, 0-1): Weighted average of all confidence fields. Computed server-side as: `(title * 0.4) + (dateTime * 0.3 or 0.2 if missing) + (tags * 0.15) + (priority * 0.15)`.

### LLM Prompt Changes

The current system prompt asks the LLM to extract task structure. Extend it to also assess whether the input IS a task:

Add to the prompt:
```
Also determine:
- "is_task": true if the input contains a clear actionable task (something to do, schedule, or complete). false if it's just a note, observation, thought, or informational text.
- "matched_text": the exact substring from the input that represents the task. Must be a verbatim substring.
```

Add to the JSON schema in the prompt:
```json
{
  "title": "...",
  "tags": [...],
  "priority": "...",
  "date_expression": "...",
  "is_task": true/false,
  "matched_text": "exact substring from input"
}
```

### Confidence.overall Computation

Server-side, after building the response:

```javascript
const weights = { title: 0.4, dateTime: 0.3, tags: 0.15, priority: 0.15 };
const overall =
  ((confidence.title || 0) * weights.title) +
  ((confidence.dateTime || 0.5) * weights.dateTime) +
  ((confidence.tags || 0.5) * weights.tags) +
  ((confidence.priority || 0.5) * weights.priority);
confidence.overall = Math.round(overall * 100) / 100;
```

Note: All fields use 0.5 as fallback when missing. Current parser sets static values (title: 0.9, priority: 0.7), so overall is mostly driven by `isTask` gating rather than numeric thresholds.

### Backward Compatibility

- CaptureInput (Phase 1) checks `confidence.title >= 0.6` — still works, ignores new fields
- New fields are additive — no existing field changes meaning
- `isTask` defaults to `false` if LLM doesn't return it — treat missing field as non-authoritative to prevent false positives from the existing title-fallback behavior

---

## Part 2: Inline Detection Hook

### `useInlineTaskDetection(editor)`

A React hook that watches editor content changes, detects the last-modified paragraph, debounces, calls parse-task, and manages highlight/suggestion state.

**Parameters:**
- `editor`: BlockNote editor instance

**Returns:**
```javascript
{
  suggestion: { result, paragraphId, matchedText } | null,
  isParsing: boolean,
  addTask: () => void,
  dismissSuggestion: () => void,
}
```

### Detection Flow

1. Editor `onChange` fires
2. Hook identifies which paragraph block changed (compare to previous snapshot)
3. If a paragraph changed and is non-empty:
   - Start 1200ms debounce timer (clear any previous timer)
   - Track a `requestId` (incrementing counter)
4. After debounce:
   - Extract plain text from the changed paragraph block
   - Skip if text length < 5 characters
   - Skip if text hash matches a dismissed entry
   - Skip if IME composition is active (`compositionstart`/`compositionend` tracking)
   - Call `/api/ai/parse-task` with the paragraph text
5. On response:
   - Discard if `requestId` doesn't match current (stale response)
   - Discard if `isTask === false`
   - Discard if `confidence.overall < 0.7`
   - Otherwise: set suggestion state with result + paragraphId

### Highlight Approach

**Ephemeral CSS overlay — NOT inline editor styles.**

Reason: BlockNote auto-saves `editor.document` including all inline styles. Using `backgroundColor` would persist highlights into the capture document.

Instead:
- Highlight is at the PARAGRAPH level (not phrase-level substring). The `matchedText` field is used for the suggestion panel display, not for DOM range selection — phrase-level highlighting is too fragile in a rich text editor.
- Find the DOM element for the target paragraph block via `document.querySelector([data-id="${paragraphId}"])`
- Apply a CSS class (e.g., `ai-task-highlight`) to the paragraph's DOM node
- The CSS class adds a subtle left border + faint background
- Remove the class on dismiss, add, or when typing resumes

```css
.ai-task-highlight {
  border-left: 3px solid var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, transparent);
  border-radius: 4px;
  transition: background 150ms ease, border-color 150ms ease;
}
```

This is purely DOM-level styling — never touches BlockNote's content model, never gets saved.

### Dismiss Tracking

- Dismissed paragraphs tracked by content hash (simple string hash)
- Stored in a `Set<string>` in component state (not persisted — resets on page navigation)
- Editing a dismissed paragraph changes its hash, so detection re-enables

### IME Handling

Track `compositionstart` and `compositionend` events on the editor's DOM element:

```javascript
const [isComposing, setIsComposing] = useState(false);

useEffect(() => {
  const dom = editor.domElement;
  if (!dom) return;
  const onStart = () => setIsComposing(true);
  const onEnd = () => setIsComposing(false);
  dom.addEventListener("compositionstart", onStart);
  dom.addEventListener("compositionend", onEnd);
  return () => {
    dom.removeEventListener("compositionstart", onStart);
    dom.removeEventListener("compositionend", onEnd);
  };
}, [editor]);
```

Skip detection while `isComposing` is true.

---

## Part 3: Floating Suggestion Panel

### `FloatingSuggestion` Component

A floating panel anchored to the highlighted paragraph. Shows detected task info with Add/Dismiss buttons.

### Positioning

- Use `@floating-ui/react` (or `@floating-ui/dom`) for positioning
- Anchor element: the paragraph DOM node with `ai-task-highlight` class
- Placement: `bottom-start`
- Offset: 4px vertical gap
- Auto-flip if near viewport edge
- Rendered as React portal (`createPortal`) to avoid editor DOM conflicts

### UI

Same visual language as SuggestionBar but floating:

```
┌─ ✦ Meeting with Prof. Lee · Apr 8 · 14:00  [Add] [✕] ─┐
```

- Magic wand icon + primary color
- Title + date + time dot-separated
- "Add" button (calls `addTask()` from hook)
- Dismiss X button (calls `dismissSuggestion()` from hook)
- Disappears when:
  - User starts typing (debounce timer resets)
  - User clicks Add or Dismiss
  - Paragraph is deleted
  - User scrolls the highlighted paragraph out of view (optional, can defer)

### Dependency

`@floating-ui/react` needs to be installed. Check if it's already a dependency — if not, add it.

---

## Phasing

1. Extend parse-task API (backend, testable independently)
2. Create useInlineTaskDetection hook (logic, testable with mocks)
3. Create FloatingSuggestion component (UI)
4. Integrate into InboxEditor
5. Smoke test

---

## Files Affected

- Modify: `app/api/ai/parse-task/route.js` — extend prompt + response
- Create: `hooks/useInlineTaskDetection.js` — editor detection hook
- Create: `components/inbox/FloatingSuggestion.js` — floating panel UI
- Modify: `components/inbox/InboxEditor.js` — integrate hook + panel
- Modify: `app/globals.css` — add `.ai-task-highlight` class
- Modify: `package.json` — add `@floating-ui/react` if not present

---

## Risks and Mitigations

- **LLM false positives on prose**: Mitigated by `isTask` field — LLM explicitly judges. Combined with 0.7 overall threshold, should filter most false triggers.
- **Stale async responses**: Mitigated by `requestId` tracking. Responses from before the latest edit are discarded.
- **DOM manipulation fragility**: Paragraph highlight uses `data-id` selector which BlockNote generates. If BlockNote changes this, highlight breaks. Mitigated by keeping highlight purely cosmetic — detection still works, just no visual indicator.
- **Performance**: Only one paragraph analyzed per debounce cycle. 1200ms debounce prevents excessive API calls. Max 1 suggestion at a time.
- **@floating-ui bundle size**: ~3KB gzipped. Acceptable trade-off for proper positioning.
