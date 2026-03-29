# Frontend Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically improve frontend quality across accessibility, theme consistency, error handling, mobile UX, component unification, micro-interactions, and visual polish — with zero new dependencies.

**Architecture:** Phase-based, foundation-first. Theme system + accessibility fixes land first so every subsequent change inherits dark mode support automatically. Each task produces a working, buildable commit.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS 4 (`@theme inline`), React 19, CSS custom properties, Intersection Observer API.

**Design Spec:** `docs/superpowers/specs/2026-03-30-frontend-improvement-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `app/error.js` | Global error boundary ("use client", calls `reset()`) |
| `app/not-found.js` | Custom 404 page |
| `app/loading.js` | Root loading fallback (skeleton shimmer) |
| `components/ui/Skeleton.js` | Reusable skeleton loader primitive |
| `components/ui/EmptyState.js` | Unified empty state (icon + title + description + action) |
| `components/ui/ErrorState.js` | Unified error state (message + retry) |
| `components/ui/ScrollReveal.js` | Intersection Observer scroll-triggered fade-in (client component) |

### Key Modified Files
| File | What Changes |
|---|---|
| `app/globals.css` | Accent CSS var, skip-to-content, new keyframes, stagger utility |
| `app/layout.js` | Skip-to-content link, `id="main-content"` on `<main>` |
| `components/ui/Button.js` | `size`, `ghost` variant, `loading` prop, `focus-visible` |
| `components/ui/Input.js` | `size`, `aria-invalid`, `aria-describedby`, `focus-visible` |
| `lib/utils.js` | getCategoryColor → CSS vars, getCategoryIndicatorColor, STATUS_CONFIG → CSS vars, PRIORITY_CONFIG → CSS vars |
| `app/page.js` | Color purge + hero gradient + card hover + scroll-triggered fade |
| `app/login/page.js` | Color purge + gradient bg + ErrorState + Button `loading` |
| `app/inbox/page.js` | Spinner → skeleton, color purge, EmptyState, ARIA live |
| `app/calendar/page.js` | Spinner → skeleton, color purge |
| `components/tasks/TaskItem.js` | Color purge, import utils, touch opacity, target sizes, checkmark animation |
| `components/tasks/QuickAdd.js` | PRIORITY_CONFIG → CSS vars, chip colors → CSS vars |
| `components/dashboard/StatsOverview.js` | Icon colors → CSS vars |
| `components/tasks/TaskSection.js` | Stagger animation class on children |

---

## Phase 1: Foundation — Accessibility + Theme Consistency

### Task 1: Global Accessibility + Accent CSS Variable

**Files:**
- Modify: `app/globals.css` (lines 4-283 for vars, line 397 for skip-to-content)
- Modify: `app/layout.js` (lines 28-44)

**Context:** `globals.css` already has `@media (prefers-reduced-motion: reduce)` at lines 401-408 — no change needed there. The `@theme inline` block at lines 227-283 maps CSS vars to Tailwind utilities.

- [ ] **Step 1: Add accent CSS variables to `:root`**

In `app/globals.css`, add after the `--info-light` line (line 50):

```css
    --accent: #8b5cf6;
    --accent-hover: #7c3aed;
    --accent-light: rgba(139, 92, 246, 0.1);
```

- [ ] **Step 2: Add accent CSS variables to `.dark`**

In `app/globals.css`, add after the `.dark` `--info-light` line (line 161):

```css
    --accent: #a78bfa;
    --accent-hover: #8b5cf6;
    --accent-light: rgba(139, 92, 246, 0.15);
```

- [ ] **Step 3: Register accent in `@theme inline`**

In `app/globals.css`, add after the `--color-info-light` line (line 269):

```css
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-light: var(--accent-light);
```

- [ ] **Step 4: Add skip-to-content CSS class**

In `app/globals.css`, add after the `body` block (after line 289):

```css
.skip-to-content {
  position: absolute;
  left: -9999px;
  z-index: 999;
  padding: 0.5rem 1rem;
  background: var(--primary);
  color: var(--text-inverted);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}
.skip-to-content:focus-visible {
  left: 1rem;
  top: 1rem;
  position: fixed;
}
```

- [ ] **Step 5: Add skip-to-content link and `id="main-content"` to layout.js**

In `app/layout.js`, change:

```jsx
        <ThemeProvider>
          <Providers>
            <Navbar />
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
```

To:

```jsx
        <ThemeProvider>
          <Providers>
            <a href="#main-content" className="skip-to-content">
              Skip to content
            </a>
            <Navbar />
            <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
```

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css app/layout.js
git commit -m "feat: add accent CSS variable + skip-to-content accessibility"
```

---

### Task 2: Button Enhancement

**Files:**
- Modify: `components/ui/Button.js` (full rewrite, 30 lines → ~45 lines)

- [ ] **Step 1: Rewrite Button.js**

Replace the entire content of `components/ui/Button.js` with:

```jsx
import { FaSpinner } from "react-icons/fa";

export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary text-text-inverted hover:bg-primary-hover",
    secondary: "bg-background-tertiary text-text-primary hover:bg-surface-active",
    danger: "bg-danger text-text-inverted hover:bg-danger-hover",
    success: "bg-success text-text-inverted hover:bg-success-hover",
    outline: "border-2 border-primary text-primary hover:bg-primary-light",
    ghost: "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
  };

  const sizes = {
    sm: "py-1.5 px-3 text-sm gap-1.5",
    md: "py-2 px-4 text-base gap-2",
    lg: "py-3 px-6 text-lg gap-2.5",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <FaSpinner className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds. Existing Button usage is backward-compatible (default size=md matches old py-2 px-4).

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.js
git commit -m "feat: add size, ghost variant, and loading prop to Button"
```

---

### Task 3: Input Enhancement

**Files:**
- Modify: `components/ui/Input.js` (35 lines → ~50 lines)

- [ ] **Step 1: Rewrite Input.js**

Replace the entire content of `components/ui/Input.js` with:

```jsx
import { useId } from "react";

export default function Input({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  size = "md",
  className = "",
  ...props
}) {
  const generatedId = useId();
  const inputId = name || generatedId;
  const errorId = `${inputId}-error`;

  const sizes = {
    sm: "py-1.5 px-2.5 text-sm",
    md: "py-2 px-3 text-base",
    lg: "py-3 px-4 text-lg",
  };

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary mb-1">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <input
        type={type}
        id={inputId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full ${sizes[size]} border border-input-border rounded-lg bg-input-bg text-text-primary focus-visible:ring-2 focus-visible:ring-input-border-focus focus-visible:border-transparent outline-none transition-all ${
          error ? "border-danger" : ""
        } ${className}`}
        {...props}
      />
      {error && <p id={errorId} className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds. Backward-compatible (default size=md matches old py-2 px-3).

- [ ] **Step 3: Commit**

```bash
git add components/ui/Input.js
git commit -m "feat: add size, aria-invalid, and focus-visible to Input"
```

---

### Task 4: Utility Color Consolidation

**Files:**
- Modify: `lib/utils.js` (lines 49-57 getCategoryColor, lines 270-307 STATUS_CONFIG, lines 309-328 PRIORITY_CONFIG)

**Context:** `getCategoryColor` at line 49 returns badge classes with hardcoded Tailwind colors. `STATUS_CONFIG` and `PRIORITY_CONFIG` use `dark:` prefixes that can be replaced with CSS variable utilities since our theme system provides both light/dark values.

- [ ] **Step 1: Update getCategoryColor to use CSS variables**

In `lib/utils.js`, replace lines 49-57:

```javascript
export function getCategoryColor(category) {
  const colors = {
    work: "bg-blue-100 text-blue-800",
    personal: "bg-green-100 text-green-800",
    health: "bg-red-100 text-red-800",
    other: "bg-gray-100 text-gray-800"
  };
  return colors[category] || colors.other;
}
```

With:

```javascript
export function getCategoryColor(category) {
  const colors = {
    work: "bg-primary-light text-primary",
    personal: "bg-success-light text-success",
    health: "bg-danger-light text-danger",
    other: "bg-background-tertiary text-text-secondary"
  };
  return colors[category] || colors.other;
}
```

- [ ] **Step 2: Add getCategoryIndicatorColor**

Add after `getCategoryColor` (after the closing brace):

```javascript
/**
 * Get category indicator strip color (solid, for left-border indicators)
 * @param {string} category - Category name
 * @returns {string} Tailwind CSS class for background
 */
export function getCategoryIndicatorColor(category) {
  const colors = {
    work: "bg-primary",
    personal: "bg-success",
    health: "bg-danger",
    other: "bg-text-muted"
  };
  return colors[category] || colors.other;
}
```

- [ ] **Step 3: Update STATUS_CONFIG to use CSS variables**

Replace the entire `STATUS_CONFIG` object (lines 270-307):

```javascript
export const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    labelZh: "待處理",
    icon: "clock",
    color: "bg-warning/10 text-warning border-warning/30",
    textColor: "text-warning",
    dotColor: "bg-warning",
    selectedBg: "bg-warning/8 border-warning/20",
  },
  in_progress: {
    label: "In Progress",
    labelZh: "進行中",
    icon: "play",
    color: "bg-primary/10 text-primary border-primary/30",
    textColor: "text-primary",
    dotColor: "bg-primary",
    selectedBg: "bg-primary/8 border-primary/20",
  },
  completed: {
    label: "Completed",
    labelZh: "已完成",
    icon: "check",
    color: "bg-success/10 text-success border-success/30",
    textColor: "text-success",
    dotColor: "bg-success",
    selectedBg: "bg-success/8 border-success/20",
  },
  snoozed: {
    label: "Snoozed",
    labelZh: "已延後",
    icon: "pause",
    color: "bg-accent/10 text-accent border-accent/30",
    textColor: "text-accent",
    dotColor: "bg-accent",
    selectedBg: "bg-accent/8 border-accent/20",
  },
};
```

- [ ] **Step 4: Update PRIORITY_CONFIG to use CSS variables**

Replace the entire `PRIORITY_CONFIG` object (lines 309-328):

```javascript
export const PRIORITY_CONFIG = {
  high: {
    label: "High",
    dotColor: "bg-danger",
    textColor: "text-danger",
    selectedBg: "bg-danger/8 border-danger/20",
  },
  medium: {
    label: "Medium",
    dotColor: "bg-warning",
    textColor: "text-warning",
    selectedBg: "bg-warning/8 border-warning/20",
  },
  low: {
    label: "Low",
    dotColor: "bg-success",
    textColor: "text-success",
    selectedBg: "bg-success/8 border-success/20",
  },
};
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: Build succeeds. All components importing from lib/utils get updated colors automatically.

- [ ] **Step 6: Commit**

```bash
git add lib/utils.js
git commit -m "refactor: migrate category/status/priority colors to CSS variables"
```

---

### Task 5: Color Purge — Landing Page

**Files:**
- Modify: `app/page.js` (lines 20-82, replace all `dark:` patterns)

**Replacement map for this file:**

| Line | Current | Replacement |
|---|---|---|
| 20 | `text-blue-600 dark:text-blue-400` | `text-primary` |
| 21 | `text-gray-900 dark:text-white` | `text-text-primary` |
| 24 | `text-gray-600 dark:text-gray-300` | `text-text-secondary` |
| 42 | `bg-white dark:bg-gray-800` | `bg-surface` |
| 43 | `text-gray-900 dark:text-white` | `text-text-primary` |
| 46 | `text-blue-600 dark:text-blue-400` | `text-primary` |
| 47 | `text-gray-800 dark:text-gray-100` | `text-text-primary` |
| 50 | `text-gray-600 dark:text-gray-300` | `text-text-secondary` |
| 56 | `text-green-600 dark:text-green-400` | `text-success` |
| 57 | `text-gray-800 dark:text-gray-100` | `text-text-primary` |
| 60 | `text-gray-600 dark:text-gray-300` | `text-text-secondary` |
| 66 | `text-purple-600 dark:text-purple-400` | `text-accent` |
| 67 | `text-gray-800 dark:text-gray-100` | `text-text-primary` |
| 70 | `text-gray-600 dark:text-gray-300` | `text-text-secondary` |
| 79 | `text-gray-900 dark:text-white` | `text-text-primary` |
| 82 | `text-gray-600 dark:text-gray-300` | `text-text-secondary` |

- [ ] **Step 1: Apply all replacements to app/page.js**

Replace each hardcoded color pattern with its CSS variable equivalent from the table above. Every `dark:text-*` / `dark:bg-*` pair becomes a single CSS variable class.

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/page.js
git commit -m "refactor: replace hardcoded colors with CSS variables in landing page"
```

---

### Task 6: Color Purge — Login Page

**Files:**
- Modify: `app/login/page.js` (lines 57, 67)

- [ ] **Step 1: Replace icon color**

Line 57: `text-blue-600 dark:text-blue-400` → `text-primary`

- [ ] **Step 2: Replace error message colors**

Line 67: Replace:
```jsx
<div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
```

With:
```jsx
<div className="bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded">
```

- [ ] **Step 3: Build check**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add app/login/page.js
git commit -m "refactor: replace hardcoded colors with CSS variables in login page"
```

---

### Task 7: Color Purge — Inbox + Calendar Pages

**Files:**
- Modify: `app/inbox/page.js` (lines 187-188, 199, 216)
- Modify: `app/calendar/page.js` (lines 211-212, 224, 238-249)

- [ ] **Step 1: Inbox — Replace loading spinner**

Lines 187-188: Replace:
```jsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
<p className="text-gray-600 dark:text-gray-300">Loading inbox...</p>
```

With:
```jsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
<p className="text-text-secondary">Loading inbox...</p>
```

- [ ] **Step 2: Inbox — Replace header icon color**

Line 199: `text-blue-500` → `text-primary`

- [ ] **Step 3: Inbox — Replace AI Assistant button colors**

Line 216: Replace:
```jsx
className="flex items-center justify-center gap-2 p-3 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors border-2 border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500"
```

With:
```jsx
className="flex items-center justify-center gap-2 p-3 text-accent hover:bg-accent-light rounded-lg transition-colors border-2 border-dashed border-accent/30 hover:border-accent/50"
```

- [ ] **Step 4: Calendar — Replace loading spinner**

Lines 211-212: Same replacement as inbox (border-primary + text-text-secondary).

- [ ] **Step 5: Calendar — Replace header icon color**

Line 224: `text-blue-500` → `text-primary`

- [ ] **Step 6: Calendar — Replace view toggle button colors**

Lines 238 and 248: Replace `bg-blue-500 text-white` with `bg-primary text-text-inverted`.

- [ ] **Step 7: Build check**

Run: `npm run build`

- [ ] **Step 8: Commit**

```bash
git add app/inbox/page.js app/calendar/page.js
git commit -m "refactor: replace hardcoded colors with CSS variables in inbox and calendar"
```

---

### Task 8: Color Purge — TaskItem.js

**Files:**
- Modify: `components/tasks/TaskItem.js` (lines 9, 43-51, 119-122, 158, 197, 205, 211, 221, 240, 247, 260, 264-267)

- [ ] **Step 1: Import getCategoryIndicatorColor from utils**

Line 9: Change:
```javascript
import { getPriorityConfig } from "@/lib/utils";
```

To:
```javascript
import { getPriorityConfig, getCategoryIndicatorColor } from "@/lib/utils";
```

- [ ] **Step 2: Remove inline getCategoryColor function**

Delete lines 43-51 (the entire `getCategoryColor` function).

- [ ] **Step 3: Update category indicator to use imported function**

Line 114: Change:
```jsx
<div className={`w-1 h-full min-h-[40px] rounded-full ${getCategoryColor(currentTask.category)}`} />
```

To:
```jsx
<div className={`w-1 h-full min-h-[40px] rounded-full ${getCategoryIndicatorColor(currentTask.category)}`} />
```

- [ ] **Step 4: Replace checkbox colors**

Lines 119-123: Replace:
```jsx
className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 transition-[border-color,background-color] duration-200 ${
  currentTask.completed
    ? "bg-green-500 border-green-500"
    : "hover:border-blue-500"
}`}
```

With:
```jsx
className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 transition-[border-color,background-color] duration-200 ${
  currentTask.completed
    ? "bg-success border-success"
    : "hover:border-primary"
}`}
```

- [ ] **Step 5: Replace overdue hex color**

Line 158: Change `"#dc2626"` to `"var(--danger)"`:
```jsx
style={{ color: isOverdue ? "var(--danger)" : "var(--text-muted)" }}
```

- [ ] **Step 6: Replace snoozed indicator color**

Line 197: Change `text-purple-500` to `text-accent`:
```jsx
<div className="flex items-center gap-1 mt-1 text-xs text-accent">
```

- [ ] **Step 7: Replace action button hover colors**

Line 211: Replace `text-purple-500 hover:text-purple-700 hover:bg-purple-500/10` with `text-accent hover:text-accent-hover hover:bg-accent/10`

Line 221: Replace `hover:text-purple-500` with `hover:text-accent`

Line 240: Replace `hover:text-blue-600` with `hover:text-primary`

Line 247: Replace `hover:text-red-600` with `hover:text-danger`

- [ ] **Step 8: Replace subtask colors**

Line 260: Replace `hover:bg-gray-500/10` with `hover:bg-surface-hover`

Lines 264-267: Replace:
```jsx
className={`flex-shrink-0 w-4 h-4 rounded border transition-[border-color,background-color] duration-200 ${
  subtask.completed
    ? "bg-purple-500 border-purple-500"
    : "hover:border-purple-500"
}`}
```

With:
```jsx
className={`flex-shrink-0 w-4 h-4 rounded border transition-[border-color,background-color] duration-200 ${
  subtask.completed
    ? "bg-accent border-accent"
    : "hover:border-accent"
}`}
```

- [ ] **Step 9: Build check**

Run: `npm run build`

- [ ] **Step 10: Commit**

```bash
git add components/tasks/TaskItem.js
git commit -m "refactor: replace hardcoded colors with CSS variables in TaskItem"
```

---

### Task 9: Color Purge — QuickAdd.js + StatsOverview.js

**Files:**
- Modify: `components/tasks/QuickAdd.js` (lines 9-12, 323, 333, 358, 379, 406)
- Modify: `components/dashboard/StatsOverview.js` (lines 14, 22, 30)

- [ ] **Step 1: QuickAdd — Update local PRIORITY_CONFIG**

Lines 9-13: Replace:
```javascript
const PRIORITY_CONFIG = {
  high: { label: "High", labelZh: "高", color: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30" },
  medium: { label: "Medium", labelZh: "中", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30" },
  low: { label: "Low", labelZh: "低", color: "bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30" },
};
```

With:
```javascript
const PRIORITY_CONFIG = {
  high: { label: "High", labelZh: "高", color: "bg-danger/15 text-danger border border-danger/30" },
  medium: { label: "Medium", labelZh: "中", color: "bg-warning/15 text-warning border border-warning/30" },
  low: { label: "Low", labelZh: "低", color: "bg-success/15 text-success border border-success/30" },
};
```

- [ ] **Step 2: QuickAdd — Replace spinner color**

Line 323: Change `text-blue-500` to `text-primary`:
```jsx
<FaSpinner className="w-4 h-4 animate-spin text-primary" />
```

- [ ] **Step 3: QuickAdd — Replace DateTime chip colors**

Line 333: Replace:
```jsx
className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 cursor-pointer hover:opacity-80 transition-opacity"
```

With:
```jsx
className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/30 cursor-pointer hover:opacity-80 transition-opacity"
```

- [ ] **Step 4: QuickAdd — Replace Duration chip colors**

Line 358: Replace:
```jsx
className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
```

With:
```jsx
className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30"
```

- [ ] **Step 5: QuickAdd — Replace parsed title preview color**

Line 379: Replace `text-gray-500 dark:text-gray-400` with `text-text-muted`.

- [ ] **Step 6: QuickAdd — Replace date picker close button color**

Line 406: Replace `text-gray-500 hover:text-gray-700` with `text-text-muted hover:text-text-secondary`.

- [ ] **Step 7: StatsOverview — Replace icon colors**

Line 14: `text-green-500` → `text-success`
Line 22: `text-blue-500` → `text-primary`
Line 30: `text-red-500` → `text-danger`

- [ ] **Step 8: Build check**

Run: `npm run build`

- [ ] **Step 9: Commit**

```bash
git add components/tasks/QuickAdd.js components/dashboard/StatsOverview.js
git commit -m "refactor: replace hardcoded colors with CSS variables in QuickAdd and StatsOverview"
```

---

## Phase 2: Error Handling + Loading States

### Task 10: Error Boundaries

**Files:**
- Create: `app/error.js`
- Create: `app/not-found.js`
- Create: `app/loading.js`

- [ ] **Step 1: Create app/error.js**

```jsx
"use client";

export default function Error({ error, reset }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-danger-light flex items-center justify-center">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-text-secondary mb-6">An unexpected error occurred. Please try again.</p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center py-2 px-6 rounded-lg font-medium bg-primary text-text-inverted hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/not-found.js**

```jsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-text-muted mb-4">404</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Page not found</h2>
        <p className="text-text-secondary mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center py-2 px-6 rounded-lg font-medium bg-primary text-text-inverted hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create app/loading.js**

```jsx
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="skeleton-line h-7 w-32" />
        <div className="skeleton-line h-4 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 space-y-2">
            <div className="skeleton-line h-3 w-16" />
            <div className="skeleton-line h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="skeleton-line w-5 h-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-line h-4 w-3/4" />
              <div className="skeleton-line h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build check**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/error.js app/not-found.js app/loading.js
git commit -m "feat: add error boundary, 404 page, and root loading fallback"
```

---

### Task 11: Skeleton Component + Page Skeletons

**Files:**
- Create: `components/ui/Skeleton.js`
- Modify: `app/inbox/page.js` (lines 183-191 loading state)
- Modify: `app/calendar/page.js` (lines 207-215 loading state)

- [ ] **Step 1: Create Skeleton.js**

```jsx
export default function Skeleton({ width, height, rounded = "md", className = "" }) {
  const roundedMap = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  };

  return (
    <div
      className={`skeleton-line ${roundedMap[rounded] || roundedMap.md} ${className}`}
      style={{
        width: width || "100%",
        height: height || "1rem",
      }}
    />
  );
}
```

- [ ] **Step 2: Replace inbox loading spinner with skeleton**

In `app/inbox/page.js`, replace the loading block (lines 184-191):

```jsx
if (status === "loading" || loading) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="skeleton-line h-7 w-32 mb-2" />
        <div className="skeleton-line h-4 w-56" />
      </div>
      {/* Quick actions skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="skeleton-line h-12 rounded-lg" />
        <div className="skeleton-line h-12 rounded-lg" />
      </div>
      {/* Task list skeleton */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="skeleton-line w-1 h-10 rounded-full" />
            <div className="skeleton-line w-5 h-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-line h-4 w-3/4" />
              <div className="skeleton-line h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace calendar loading spinner with skeleton**

In `app/calendar/page.js`, replace the loading block (lines 208-215):

```jsx
if (status === "loading" || loading || !currentMonth || !selectedDate) {
  return (
    <div className="max-w-6xl mx-auto px-4 pb-20 space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="skeleton-line h-7 w-32 mb-2" />
        <div className="skeleton-line h-4 w-48" />
      </div>
      {/* Calendar grid skeleton */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex justify-between mb-4">
          <div className="skeleton-line h-6 w-32" />
          <div className="flex gap-2">
            <div className="skeleton-line w-8 h-8 rounded" />
            <div className="skeleton-line w-8 h-8 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="skeleton-line h-10 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build check**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add components/ui/Skeleton.js app/inbox/page.js app/calendar/page.js
git commit -m "feat: add Skeleton component, replace spinners with page-specific skeletons"
```

---

### Task 12: ARIA Live Regions

**Files:**
- Modify: `components/tasks/TaskSection.js` (line 118, the task list wrapper)
- Modify: `app/inbox/page.js` (task list area)

**Context:** Add `aria-live="polite"` to containers whose content changes dynamically (task completion, filter changes).

- [ ] **Step 1: Add aria-live to TaskSection task list**

In `components/tasks/TaskSection.js`, on the `<div className="space-y-2">` at line 118:

Change:
```jsx
<div className="space-y-2">
```

To:
```jsx
<div className="space-y-2" aria-live="polite">
```

- [ ] **Step 2: Verify inbox page uses TaskSection**

Check that the inbox page renders tasks through TaskSection (which now has aria-live). If any dynamic lists render outside TaskSection, add `aria-live="polite"` to those containers as well.

- [ ] **Step 3: Build check**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/tasks/TaskSection.js
git commit -m "feat: add ARIA live regions for dynamic task list updates"
```

---

## Phase 3: Mobile UX

### Task 13: Mobile Touch UX

**Files:**
- Modify: `components/tasks/TaskItem.js` (lines 117-123 checkbox, lines 205 action buttons, lines 238-250 button padding, lines 262-267 subtask checkbox)

- [ ] **Step 1: Make action buttons visible on mobile**

Line 205: Replace:
```jsx
<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
```

With:
```jsx
<div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
```

- [ ] **Step 2: Increase checkbox touch target**

Lines 117-123: Wrap the checkbox button with a larger touch target. Change:
```jsx
<button
  onClick={handleToggle}
  className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 ...`}
```

To:
```jsx
<button
  onClick={handleToggle}
  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 ...`}
```

(Change `w-5 h-5 mt-0.5` to `w-6 h-6`, remove mt-0.5 since the extra size covers alignment)

- [ ] **Step 3: Increase action button padding**

Lines 221, 238, 245: Change all `p-1.5` to `p-2.5` on the snooze, edit, and delete buttons:

```jsx
className="p-2.5 hover:text-accent transition-colors"  /* snooze */
className="p-2.5 hover:text-primary transition-colors"  /* edit */
className="p-2.5 hover:text-danger transition-colors"   /* delete */
```

- [ ] **Step 4: Increase subtask checkbox touch area**

Lines 262-268: Add padding wrapper or increase size. Change `w-4 h-4` to `w-5 h-5`:

```jsx
className={`flex-shrink-0 w-5 h-5 rounded border ...`}
```

- [ ] **Step 5: Build check**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add components/tasks/TaskItem.js
git commit -m "feat: improve mobile touch accessibility — visible actions, larger targets"
```

---

## Phase 4: Empty + Error State Consistency

### Task 14: EmptyState Component + Replacements

**Files:**
- Create: `components/ui/EmptyState.js`
- Modify: `components/tasks/TaskSection.js` (lines 134-149 empty state rendering)
- Modify: `app/inbox/page.js` (empty state area)

- [ ] **Step 1: Create EmptyState.js**

```jsx
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 mb-4 text-text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update TaskSection to use EmptyState for simple empty messages**

In `components/tasks/TaskSection.js`, import EmptyState and update the empty rendering. Keep the existing `emptyAction` click-card pattern for backward compatibility, but replace the plain `emptyMessage` text with EmptyState when no emptyAction is provided.

Change lines 145-148:
```jsx
) : (
  <p className="text-sm py-3 px-4" style={{ color: "var(--text-muted)" }}>
    {emptyMessage}
  </p>
)
```

To:
```jsx
) : (
  <EmptyState title={emptyMessage} />
)
```

Add import at top:
```javascript
import EmptyState from "@/components/ui/EmptyState";
```

- [ ] **Step 3: Update inbox empty state**

In `app/inbox/page.js`, find the empty state block (the `<FaInbox>` icon + message section) and replace with:

```jsx
<EmptyState
  icon={<FaInbox className="w-full h-full" />}
  title="Your inbox is empty"
  description="Start capturing ideas and tasks quickly"
/>
```

Add import: `import EmptyState from "@/components/ui/EmptyState";`

- [ ] **Step 4: Build check**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add components/ui/EmptyState.js components/tasks/TaskSection.js app/inbox/page.js
git commit -m "feat: add EmptyState component, replace inconsistent empty patterns"
```

---

### Task 15: ErrorState Component + Replacements

**Files:**
- Create: `components/ui/ErrorState.js`
- Modify: `app/login/page.js` (line 67 error display — already updated to CSS vars in Task 6, now swap to component)

- [ ] **Step 1: Create ErrorState.js**

```jsx
export default function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded-lg">
      <p className="text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-sm font-medium underline hover:no-underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace login page error with ErrorState**

In `app/login/page.js`, replace the error div (line 67):

```jsx
{error && (
  <div className="bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded">
    {error}
  </div>
)}
```

With:
```jsx
{error && <ErrorState message={error} />}
```

Add import: `import ErrorState from "@/components/ui/ErrorState";`

- [ ] **Step 3: Build check**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/ui/ErrorState.js app/login/page.js
git commit -m "feat: add ErrorState component, replace login error pattern"
```

---

## Phase 5: Micro-Interactions

### Task 16: Micro-Interactions — CSS Animations

**Files:**
- Modify: `app/globals.css` (add checkmark draw + border pulse + stagger utility)
- Modify: `components/tasks/TaskItem.js` (checkmark SVG animation)
- Modify: `components/tasks/TaskSection.js` (stagger class)

**Context:** globals.css already has `slideUp` keyframe (lines 322-325) which is the same motion as "fade-in-up". Modal exit transitions already exist. This task adds: (1) checkmark draw animation, (2) border pulse, (3) stagger utility class.

- [ ] **Step 1: Add new keyframes + utility classes to globals.css**

Add before the `/* Reasoning shimmer animation */` comment (before line 410):

```css
/* Checkmark draw animation */
@keyframes checkmark-draw {
  from { stroke-dashoffset: 24; }
  to   { stroke-dashoffset: 0; }
}

/* Border pulse on task completion */
@keyframes border-pulse {
  0%   { border-left-color: var(--success); }
  50%  { border-left-color: var(--success); box-shadow: -2px 0 8px var(--success); }
  100% { border-left-color: transparent; }
}

/* Staggered list entry */
.task-stagger-enter {
  animation: slideUp var(--duration-normal) var(--ease-decelerate) both;
}
```

- [ ] **Step 2: Update TaskItem checkmark SVG to animate**

In `components/tasks/TaskItem.js`, find the main checkbox SVG (line 129-131):

```jsx
{currentTask.completed && (
  <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)}
```

Replace with:

```jsx
{currentTask.completed && (
  <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline
      points="20 6 9 17 4 12"
      strokeDasharray="24"
      strokeDashoffset="0"
      style={{ animation: "checkmark-draw 200ms var(--ease-decelerate)" }}
    />
  </svg>
)}
```

- [ ] **Step 3: Update TaskSection to apply stagger class**

In `components/tasks/TaskSection.js`, the `<ItemComponent>` render (lines 120-132) already passes `animationDelay`. Update to also pass an animation class.

Change:
```jsx
<ItemComponent
  key={task.id}
  task={task}
  onToggleComplete={onToggleComplete}
  onDelete={onDelete}
  onUpdate={onUpdate}
  onSnooze={onSnooze}
  onEdit={onEdit}
  showDate={showDate}
  isCompleting={completingIds?.has(task.id)}
  animationDelay={Math.min(index * 40, 200)}
/>
```

To:
```jsx
<ItemComponent
  key={task.id}
  task={task}
  onToggleComplete={onToggleComplete}
  onDelete={onDelete}
  onUpdate={onUpdate}
  onSnooze={onSnooze}
  onEdit={onEdit}
  showDate={showDate}
  isCompleting={completingIds?.has(task.id)}
  animationClass="task-stagger-enter"
  style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
/>
```

Note: `animationClass` is already accepted by TaskItem (line 12, destructured in props). The `style` prop merges with `dragStyle` in TaskItem's container div.

- [ ] **Step 4: Update TaskItem to apply animation style**

In `components/tasks/TaskItem.js`, the outer `<div>` (line 95-106) already applies `animationClass`. Ensure the animation delay style is applied. The component already accepts `style` via `dragStyle`, but the stagger `style` is separate.

Check that the TaskItem component's outer div merges styles. If `style` is passed as a separate prop, update the destructure and merge:

Line 12, ensure `style` or `animationStyle` is in the props. Currently `style: dragStyle` is destructured. If `style` needs to be merged:

```jsx
style={{
  backgroundColor: "var(--card-bg)",
  borderColor: "var(--card-border)",
  borderWidth: "1px",
  borderStyle: "solid",
  ...dragStyle,
}}
```

The `animationDelay` from TaskSection should be passed via `animationDelay` prop (which already exists) and applied as inline style. Update the outer div:

```jsx
style={{
  backgroundColor: "var(--card-bg)",
  borderColor: "var(--card-border)",
  borderWidth: "1px",
  borderStyle: "solid",
  animationDelay: typeof props.animationDelay === "number" ? `${props.animationDelay}ms` : undefined,
  ...dragStyle,
}}
```

Actually, simpler: just use the already-passed `animationDelay` prop. Add to destructured props on line 12:

In the forwardRef parameter list, add `animationDelay`:
```javascript
{ task, onToggleComplete, onDelete, onUpdate, onEdit, onSnooze, showDate = true, dragHandleListeners, dragHandleAttributes, isDragging, style: dragStyle, animationClass, animationDelay },
```

Then in the outer div style:
```jsx
style={{
  backgroundColor: "var(--card-bg)",
  borderColor: "var(--card-border)",
  borderWidth: "1px",
  borderStyle: "solid",
  animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
  ...dragStyle,
}}
```

- [ ] **Step 5: Build check**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/tasks/TaskItem.js components/tasks/TaskSection.js
git commit -m "feat: add checkmark draw animation, staggered list entry"
```

---

## Phase 6: Landing + Login Polish

### Task 17: Landing Page Visual Polish

**Files:**
- Modify: `app/page.js` (add hero gradient, card hover effects, icon backgrounds, scroll-triggered fade)

**Context:** Color purge was done in Task 5. This task adds visual enhancements on top.

- [ ] **Step 1: Add scroll-reveal logic and hero gradient**

Rewrite `app/page.js` — the page is a server component (has `await auth()`), so Intersection Observer needs a client wrapper. Add a `"use client"` child component inline or extract.

Since the page uses `await auth()` (server component), add a client wrapper for the interactive parts. The simplest approach: wrap the visual sections in a client component.

Create a helper at the top of the file (or inline):

Actually, since `app/page.js` is a server component, we can't use hooks directly. The cleanest approach is to add CSS-only animations triggered by a simple utility class, then wrap interactive sections.

Alternative: use CSS `@starting-style` (supported in modern browsers) or just apply animations via CSS classes. For maximum compatibility, use Intersection Observer in a thin client wrapper.

Add a new client component at the bottom of the file:

```jsx
"use client";
function ScrollReveal({ children, className = "" }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {children}
    </div>
  );
}
```

But this requires imports from React which means the file needs to be structured carefully. Since `app/page.js` is a server component, extract `ScrollReveal` into a separate tiny file:

Create `components/ui/ScrollReveal.js`:
```jsx
"use client";
import { useRef, useState, useEffect } from "react";

export default function ScrollReveal({ children, className = "" }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Update landing page with visual polish**

In `app/page.js`, add import:
```javascript
import ScrollReveal from "@/components/ui/ScrollReveal";
```

Then update the JSX:

**Hero section** (line 19): Add subtle gradient background:
```jsx
<div className="py-20 relative">
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary-light)_0%,transparent_70%)] opacity-50" />
  <div className="relative">
    {/* existing hero content */}
  </div>
</div>
```

**Features section** (line 42): Wrap in ScrollReveal, add card hover:
```jsx
<ScrollReveal>
  <div className="py-16 bg-surface rounded-lg shadow-md">
    <h2 className="text-3xl font-bold text-text-primary mb-12">Key Features</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-6">
```

Each feature card gets hover lift + icon background:
```jsx
<div className="text-center group">
  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-light flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-1">
    <FaCalendarAlt className="text-primary text-2xl" />
  </div>
  <h3 className="text-xl font-semibold text-text-primary mb-2">One-time & Recurring</h3>
  <p className="text-text-secondary">...</p>
</div>
```

Second card icon bg: `bg-success-light` + `text-success`
Third card icon bg: `bg-accent-light` + `text-accent`

**CTA section** (line 78): Wrap in ScrollReveal:
```jsx
<ScrollReveal>
  <div className="py-16">
    ...
  </div>
</ScrollReveal>
```

- [ ] **Step 3: Build check**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/ui/ScrollReveal.js app/page.js
git commit -m "feat: add landing page visual polish — gradient, card hover, scroll reveal"
```

---

### Task 18: Login Page Polish

**Files:**
- Modify: `app/login/page.js` (gradient bg, Button loading, card elevation)

- [ ] **Step 1: Add gradient background**

Wrap the outer container:
```jsx
<div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary-light)_0%,transparent_70%)] opacity-40" />
  <div className="max-w-md w-full space-y-8 relative">
```

- [ ] **Step 2: Increase card elevation**

Line 65: Change `shadow-sm` to `shadow-lg`:
```jsx
<form className="mt-8 space-y-6 bg-surface border border-border p-8 rounded-lg shadow-lg" onSubmit={handleSubmit}>
```

- [ ] **Step 3: Use Button loading prop instead of text swap**

Lines 92-98: Replace:
```jsx
<Button
  type="submit"
  variant="primary"
  className="w-full"
  disabled={isLoading}
>
  {isLoading ? "Signing in..." : "Sign In"}
</Button>
```

With:
```jsx
<Button
  type="submit"
  variant="primary"
  className="w-full"
  loading={isLoading}
>
  Sign In
</Button>
```

- [ ] **Step 4: Build check**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/login/page.js
git commit -m "feat: add login page polish — gradient background, card elevation, loading button"
```

---

## Verification

### Task 19: Final Verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build with zero errors.

- [ ] **Step 2: Grep for remaining hardcoded dark: patterns**

Run: `grep -r "dark:text-\|dark:bg-\|dark:border-" --include="*.js" app/ components/ui/ components/tasks/ components/dashboard/ components/layout/ | grep -v node_modules | grep -v ".next"`

Review output. Remaining `dark:` patterns should only be in:
- `lib/utils.js` TAG_COLORS (intentionally kept — decorative hash-based colors)
- `components/reminders/` (agent-related components, out of scope)
- Any third-party patterns

- [ ] **Step 3: Grep for remaining focus:ring patterns (should be focus-visible:ring)**

Run: `grep -rn "focus:ring" --include="*.js" components/ui/ | grep -v focus-visible`

If any results, change `focus:ring` to `focus-visible:ring` in those files.

- [ ] **Step 4: Verify modal exit transitions exist**

Confirm that `app/globals.css` contains `modal-panel-exit` and `modal-backdrop-exit` classes (they already exist at lines 351-361). No code change needed — Phase 5C from the spec is already implemented.

- [ ] **Step 5: Final commit if any fixes applied**

If grep steps found remaining issues and fixes were applied, commit them:
```bash
git add -A
git commit -m "fix: clean up remaining hardcoded colors and focus:ring patterns"
```
