# Navigation Phase 2c — Inline AI Task Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time AI task detection to the desktop Inbox editor with ephemeral paragraph highlighting and a floating suggestion panel.

**Architecture:** Extend the parse-task API with `isTask`, `matchedText`, and `confidence.overall` fields. Create a `useInlineTaskDetection` hook that watches editor changes, debounces, calls the API, and manages suggestion state. Highlight the target paragraph with a CSS class (ephemeral, never persisted). Show a floating panel via `@floating-ui/react` for Add/Dismiss actions.

**Tech Stack:** Next.js 15, BlockNote 0.47.3, AI SDK v6 (generateText), @floating-ui/react, chrono-node

**Branch:** `UI-design`

**Spec:** `docs/superpowers/specs/2026-04-05-navigation-phase2c-design.md`

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `app/api/ai/parse-task/route.js` | Extended with isTask, matchedText, confidence.overall | Modify |
| `hooks/useInlineTaskDetection.js` | Editor content watcher + parse-task + suggestion state | Create |
| `components/inbox/FloatingSuggestion.js` | Floating suggestion panel UI | Create |
| `components/inbox/InboxEditor.js` | Integrate detection hook + floating panel | Modify |
| `app/globals.css` | Add .ai-task-highlight CSS class | Modify |
| `tests/unit/parse-task-confidence.test.js` | Test confidence.overall computation | Create |
| `tests/integration/parse-task-extended.test.js` | Test extended API response shape | Create |

---

### Task 1: Extend parse-task API — LLM prompt + response

**Files:**
- Modify: `app/api/ai/parse-task/route.js`
- Create: `tests/unit/parse-task-confidence.test.js`

- [ ] **Step 1: Write the confidence.overall computation test**

```javascript
// tests/unit/parse-task-confidence.test.js
import { describe, it, expect } from "vitest";
import { computeOverallConfidence } from "@/app/api/ai/parse-task/confidence";

describe("computeOverallConfidence", () => {
  it("computes weighted average with all fields", () => {
    const result = computeOverallConfidence({
      title: 0.9,
      dateTime: 0.95,
      tags: 0.8,
      priority: 0.7,
    });
    // (0.9*0.4) + (0.95*0.3) + (0.8*0.15) + (0.7*0.15)
    // = 0.36 + 0.285 + 0.12 + 0.105 = 0.87
    expect(result).toBe(0.87);
  });

  it("uses 0.5 fallback when dateTime is missing", () => {
    const result = computeOverallConfidence({
      title: 0.9,
      tags: 0.8,
      priority: 0.7,
    });
    // (0.9*0.4) + (0.5*0.3) + (0.8*0.15) + (0.7*0.15)
    // = 0.36 + 0.15 + 0.12 + 0.105 = 0.735
    expect(result).toBe(0.74);
  });

  it("rounds to 2 decimal places", () => {
    const result = computeOverallConfidence({
      title: 0.33,
      dateTime: 0.66,
      tags: 0.99,
      priority: 0.11,
    });
    expect(typeof result).toBe("number");
    expect(String(result).split(".")[1]?.length || 0).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/parse-task-confidence.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Create the confidence computation module**

```javascript
// app/api/ai/parse-task/confidence.js

const WEIGHTS = { title: 0.4, dateTime: 0.3, tags: 0.15, priority: 0.15 };

export function computeOverallConfidence(confidence) {
  const overall =
    (confidence.title || 0) * WEIGHTS.title +
    (confidence.dateTime || 0.5) * WEIGHTS.dateTime +
    (confidence.tags || 0.5) * WEIGHTS.tags +
    (confidence.priority || 0.5) * WEIGHTS.priority;
  return Math.round(overall * 100) / 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/parse-task-confidence.test.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Update the LLM system prompt in parse-task route**

In `app/api/ai/parse-task/route.js`, extend the system prompt to include `is_task` and `matched_text`. Find the `systemPrompt` template string and add to the JSON schema section:

```
Also determine:
- "is_task": true if the input contains a clear actionable task (something to do, schedule, or complete). false if it's just a note, observation, thought, or informational text like "the weather is nice" or "I feel tired".
- "matched_text": the exact verbatim substring from the input that represents the task. Must appear in the original input unchanged.
```

Update the JSON example in the prompt:
```json
{
  "title": "...",
  "tags": [...],
  "priority": "...",
  "date_expression": "...",
  "is_task": true,
  "matched_text": "..."
}
```

- [ ] **Step 6: Add isTask, matchedText, and confidence.overall to the response**

Import the confidence module at the top:
```javascript
import { computeOverallConfidence } from "./confidence.js";
```

After building the confidence object (near the end of the POST handler, before `return NextResponse.json`), add:

```javascript
// Add isTask — default false if LLM didn't return it (non-authoritative)
const isTask = parsed.is_task === true;

// Add matchedText — the LLM's identified task substring
const matchedText = parsed.matched_text || text;

// Compute overall confidence
confidence.overall = computeOverallConfidence(confidence);
```

Then add to the response data object:
```javascript
data: {
  ...existing fields...,
  isTask: isTask,
  matchedText: matchedText,
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/ai/parse-task/route.js app/api/ai/parse-task/confidence.js tests/unit/parse-task-confidence.test.js
git commit -m "feat: extend parse-task API with isTask, matchedText, confidence.overall"
```

---

### Task 2: Add ai-task-highlight CSS class

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the highlight class**

Append to `app/globals.css`:

```css
/* Ephemeral AI task detection highlight — applied via DOM, never saved in editor content */
.ai-task-highlight {
  border-left: 3px solid var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, transparent);
  border-radius: 4px;
  transition: background 150ms ease, border-color 150ms ease;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add ai-task-highlight CSS class for ephemeral editor decoration"
```

---

### Task 3: Install @floating-ui/react

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Check if already installed**

Run: `npm ls @floating-ui/react 2>/dev/null || echo "not installed"`

- [ ] **Step 2: Install if needed**

Run: `npm install @floating-ui/react`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @floating-ui/react for floating suggestion panel"
```

---

### Task 4: Create useInlineTaskDetection hook

**Files:**
- Create: `hooks/useInlineTaskDetection.js`

- [ ] **Step 1: Create the hook**

```javascript
// hooks/useInlineTaskDetection.js
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLocale } from "next-intl";

const DEBOUNCE_MS = 1200;
const MIN_TEXT_LENGTH = 5;
const CONFIDENCE_THRESHOLD = 0.7;

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function extractParagraphText(block) {
  if (!block?.content || !Array.isArray(block.content)) return "";
  return block.content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("");
}

export default function useInlineTaskDetection(editor) {
  const locale = useLocale();
  const [suggestion, setSuggestion] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const prevBlocksRef = useRef(null);
  const dismissedRef = useRef(new Set());
  const highlightedRef = useRef(null);

  // Track IME composition — use a ref for the DOM element to handle late availability
  const composingRef = useRef(false);
  useEffect(() => {
    // BlockNote may not expose domElement immediately; retry on next tick
    const attach = () => {
      const dom = editor?.domElement;
      if (!dom) return setTimeout(attach, 100);
      const onStart = () => { composingRef.current = true; setIsComposing(true); };
      const onEnd = () => {
        composingRef.current = false;
        setIsComposing(false);
        // Trigger detection after composition ends (zh-TW input commit)
        handleEditorChange();
      };
      dom.addEventListener("compositionstart", onStart);
      dom.addEventListener("compositionend", onEnd);
      return () => {
        dom.removeEventListener("compositionstart", onStart);
        dom.removeEventListener("compositionend", onEnd);
      };
    };
    const cleanup = attach();
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, [editor, handleEditorChange]);

  // Clear highlight from DOM
  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      const el = document.querySelector(
        `[data-id="${highlightedRef.current}"]`
      );
      if (el) el.classList.remove("ai-task-highlight");
      highlightedRef.current = null;
    }
  }, []);

  // Apply highlight to DOM
  const applyHighlight = useCallback((blockId) => {
    clearHighlight();
    const el = document.querySelector(`[data-id="${blockId}"]`);
    if (el) {
      el.classList.add("ai-task-highlight");
      highlightedRef.current = blockId;
    }
  }, [clearHighlight]);

  // Detect changed paragraph
  const detectChangedParagraph = useCallback(() => {
    const currentBlocks = editor.document;
    const prevBlocks = prevBlocksRef.current;

    if (!prevBlocks) {
      prevBlocksRef.current = currentBlocks.map((b) => ({
        id: b.id,
        text: extractParagraphText(b),
      }));
      return null;
    }

    let changedBlock = null;
    for (const block of currentBlocks) {
      const prev = prevBlocks.find((p) => p.id === block.id);
      const currentText = extractParagraphText(block);
      if (!prev || prev.text !== currentText) {
        changedBlock = { id: block.id, text: currentText };
        break;
      }
    }

    prevBlocksRef.current = currentBlocks.map((b) => ({
      id: b.id,
      text: extractParagraphText(b),
    }));

    return changedBlock;
  }, [editor]);

  // Parse text with API
  const parseText = useCallback(
    async (text, blockId, reqId) => {
      setIsParsing(true);
      try {
        const res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            language: locale === "zh-TW" ? "zh" : "en",
          }),
        });
        const data = await res.json();

        // Stale response check
        if (reqId !== requestIdRef.current) return;

        if (
          data.success &&
          data.data.isTask !== false &&
          (data.data.confidence?.overall || 0) >= CONFIDENCE_THRESHOLD
        ) {
          applyHighlight(blockId);
          setSuggestion({
            result: data.data,
            paragraphId: blockId,
            matchedText: data.data.matchedText || text,
          });
        } else {
          clearHighlight();
          setSuggestion(null);
        }
      } catch {
        clearHighlight();
        setSuggestion(null);
      } finally {
        setIsParsing(false);
      }
    },
    [locale, applyHighlight, clearHighlight]
  );

  // Main onChange handler — call this from InboxEditor's onChange
  const handleEditorChange = useCallback(() => {
    // Clear previous suggestion on any edit
    clearHighlight();
    setSuggestion(null);

    // Invalidate any in-flight request immediately on every edit
    ++requestIdRef.current;

    if (isComposing) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const changed = detectChangedParagraph();
      if (!changed) return;
      if (changed.text.length < MIN_TEXT_LENGTH) return;

      const hash = hashString(changed.text);
      if (dismissedRef.current.has(hash)) return;

      const reqId = ++requestIdRef.current;
      parseText(changed.text, changed.id, reqId);
    }, DEBOUNCE_MS);
  }, [isComposing, detectChangedParagraph, parseText, clearHighlight]);

  // Add task action — also hash-dismiss to prevent re-detection of same text
  const addTask = useCallback(() => {
    if (suggestion) {
      const block = editor.document.find((b) => b.id === suggestion.paragraphId);
      const text = block ? extractParagraphText(block) : "";
      if (text) dismissedRef.current.add(hashString(text));
    }
    clearHighlight();
    const result = suggestion;
    setSuggestion(null);
    return result?.result || null;
  }, [suggestion, editor, clearHighlight]);

  // Dismiss action
  const dismissSuggestion = useCallback(() => {
    if (suggestion) {
      const text = extractParagraphText(
        editor.document.find((b) => b.id === suggestion.paragraphId)
      );
      if (text) dismissedRef.current.add(hashString(text));
    }
    clearHighlight();
    setSuggestion(null);
  }, [suggestion, editor, clearHighlight]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearHighlight();
    };
  }, [clearHighlight]);

  return {
    suggestion,
    isParsing,
    addTask,
    dismissSuggestion,
    handleEditorChange,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useInlineTaskDetection.js
git commit -m "feat: add useInlineTaskDetection hook for editor AI detection"
```

---

### Task 5: Create FloatingSuggestion component

**Files:**
- Create: `components/inbox/FloatingSuggestion.js`

- [ ] **Step 1: Create the component**

```javascript
// components/inbox/FloatingSuggestion.js
"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFloating, offset, flip, shift, autoUpdate } from "@floating-ui/react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { FaMagic } from "react-icons/fa";

export default function FloatingSuggestion({ suggestion, onAdd, onDismiss }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const anchorEl = useMemo(() => {
    if (!mounted || !suggestion?.paragraphId) return null;
    return document.querySelector(
      `[data-id="${suggestion.paragraphId}"]`
    );
  }, [mounted, suggestion?.paragraphId]);

  const { refs, floatingStyles } = useFloating({
    elements: { reference: anchorEl },
    placement: "bottom-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: anchorEl ? autoUpdate : undefined,
  });

  if (!mounted || !suggestion || !anchorEl) return null;

  const { result } = suggestion;
  const parts = [];
  if (result.title) parts.push(result.title);
  if (result.dateTime) {
    const d = new Date(result.dateTime);
    parts.push(
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );
    if (d.getHours() || d.getMinutes()) {
      parts.push(
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
    }
  }

  return createPortal(
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] shadow-lg z-50"
      style={{
        ...floatingStyles,
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        color: "var(--primary)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      }}
    >
      <FaMagic size={12} className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate max-w-[280px]">{parts.join(" · ")}</span>
      <button
        onClick={onAdd}
        className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
        style={{
          backgroundColor: "var(--primary-light)",
          color: "var(--primary)",
        }}
      >
        Add
      </button>
      <button
        onClick={onDismiss}
        className="p-0.5 rounded transition-colors hover:opacity-70"
        aria-label="Dismiss"
        style={{ color: "var(--text-muted)" }}
      >
        <FiX size={12} />
      </button>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/FloatingSuggestion.js
git commit -m "feat: add FloatingSuggestion component with floating-ui positioning"
```

---

### Task 6: Integrate detection into InboxEditor

**Files:**
- Modify: `components/inbox/InboxEditor.js`

- [ ] **Step 1: Import hook and floating panel**

Add at top of imports:

```javascript
import useInlineTaskDetection from "@/hooks/useInlineTaskDetection";
import FloatingSuggestion from "./FloatingSuggestion";
```

- [ ] **Step 2: Initialize the hook**

Inside the component, after the editor is created (`useCreateBlockNote`):

```javascript
const {
  suggestion,
  isParsing,
  addTask,
  dismissSuggestion,
  handleEditorChange,
} = useInlineTaskDetection(editor);
```

- [ ] **Step 3: Wire up the onChange handler**

Find the `<BlockNoteView>` component. Its current `onChange` is `handleContentChange` (for auto-save). Chain both handlers:

```jsx
<BlockNoteView
  editor={editor}
  theme={theme === "dark" ? "dark" : "light"}
  onChange={() => {
    handleContentChange();
    handleEditorChange();
  }}
  slashMenu={false}
>
```

- [ ] **Step 4: Add the floating panel and handle addTask**

The `addTask()` from the hook returns the parsed result. We need to create a task via `quickAdd` or a similar mechanism. Since InboxEditor doesn't currently have `quickAdd`, we need to accept it as a prop.

Add `onTaskAdded` to the props:

```javascript
export default function InboxEditor({ tasks, onToggleComplete, onDelete, onEdit, onTaskAdded }) {
```

Then add the FloatingSuggestion before the closing `</div>`:

```jsx
<FloatingSuggestion
  suggestion={suggestion}
  onAdd={() => {
    const result = addTask();
    if (result && onTaskAdded) {
      onTaskAdded(result);
    }
  }}
  onDismiss={dismissSuggestion}
/>
```

- [ ] **Step 5: Update Inbox page to pass onTaskAdded to InboxEditor**

In `app/[locale]/(app)/inbox/page.js`, update the InboxEditor usage:

```jsx
<InboxEditor
  tasks={tasks}
  onToggleComplete={toggleComplete}
  onDelete={deleteTask}
  onEdit={(id) => setSelectedTaskId(id)}
  onTaskAdded={handleTaskDetected}
/>
```

The `handleTaskDetected` callback already exists in the inbox page — it calls `quickAdd` with the parsed result.

- [ ] **Step 6: Commit**

```bash
git add components/inbox/InboxEditor.js app/[locale]/(app)/inbox/page.js
git commit -m "feat: integrate inline AI task detection into InboxEditor"
```

---

### Task 7: Smoke test

**Files:** None (verification only)

- [ ] **Step 1: Run tests and lint**

Run: `npm run test && npm run lint`
Expected: All tests pass, no lint errors.

- [ ] **Step 2: Test on desktop**

At 1024px viewport:
1. Navigate to Inbox
2. Type "meeting with Prof. Lee next Tuesday at 2pm" in the editor
3. Wait 1.2 seconds — paragraph gets subtle left-border highlight
4. Floating panel appears below with "Meeting with Prof. Lee · Apr 8 · 14:00"
5. Click Add → task created, highlight removed, panel disappears
6. Type "the weather is nice today" → no highlight, no panel (not a task)
7. Type a task, click X to dismiss → highlight removed
8. Edit the dismissed text → highlight re-triggers (hash changed)

- [ ] **Step 3: Test IME (zh-TW input)**

1. Switch to Chinese input method
2. Type with composition (pinyin/bopomofo)
3. While composing → no detection triggered
4. After committing composition → debounce starts normally

- [ ] **Step 4: Test stale response**

1. Type a task phrase
2. Immediately type more before 1.2s debounce fires
3. First parse result should be discarded (stale requestId)
4. Only the final pause triggers detection

- [ ] **Step 5: Verify highlight is ephemeral**

1. Type a task → highlight appears
2. Refresh the page
3. Editor content loads from capture document — no highlight visible
4. Confirm the saved content has no highlight styling
