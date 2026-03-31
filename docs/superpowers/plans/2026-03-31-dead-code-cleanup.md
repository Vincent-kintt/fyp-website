# Phase A: Dead Code Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all dead code, orphaned files, and unused exports so every remaining line is actively used in production.

**Architecture:** Pure deletion pass — no logic changes, no new abstractions. Functions used internally by live exports are un-exported (made module-private) rather than deleted.

**Tech Stack:** Next.js 15 (App Router), Vitest

---

## File Map

- **Delete:** `lib/auth.js`, `components/ui/Skeleton.js`, `components/reminders/AgentStepIndicator.js`, `components/reminders/AgentThinkingIndicator.js`
- **Major edit:** `lib/utils.js` (remove ~16 dead exports, un-export 4 internal symbols)
- **Minor edit:** `app/api/reminders/route.js` (remove 2 unused imports), `app/page.js` (fix 2 broken links), `auth.js` (CJS→ESM import)
- **Test edit:** `tests/utils.test.js` (remove 3 dead test blocks, update imports)

---

### Task 1: Delete Orphaned Files

**Files:**
- Delete: `lib/auth.js`
- Delete: `components/ui/Skeleton.js`
- Delete: `components/reminders/AgentStepIndicator.js`
- Delete: `components/reminders/AgentThinkingIndicator.js`

- [ ] **Step 1: Verify zero imports for each file**

Run these four greps to confirm no production code imports these files:

```bash
grep -r "lib/auth" --include="*.js" --include="*.jsx" --exclude-dir=node_modules . | grep -v "lib/auth.config"
grep -r "Skeleton" --include="*.js" --include="*.jsx" --exclude-dir=node_modules .
grep -r "AgentStepIndicator" --include="*.js" --include="*.jsx" --exclude-dir=node_modules .
grep -r "AgentThinkingIndicator" --include="*.js" --include="*.jsx" --exclude-dir=node_modules .
```

Expected: No results (or only the files themselves and possibly test files).

- [ ] **Step 2: Delete the four files**

```bash
rm lib/auth.js
rm components/ui/Skeleton.js
rm components/reminders/AgentStepIndicator.js
rm components/reminders/AgentThinkingIndicator.js
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete orphaned files (lib/auth, Skeleton, AgentStepIndicator, AgentThinkingIndicator)"
```

---

### Task 2: Clean `lib/utils.js` — Remove Dead Code

**Files:**
- Modify: `lib/utils.js`

This task removes functions/constants that have zero usage (not even internal). The next task handles symbols that are used internally but should not be exported.

- [ ] **Step 1: Remove `formatDate` (lines 5–17)**

Delete the entire function including its JSDoc comment:

```js
/**
 * Format a date to a readable string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
```

- [ ] **Step 2: Remove `formatDateTime` (lines 19–33)**

Delete the entire function including its JSDoc comment:

```js
/**
 * Format a date and time to a readable string
 * @param {Date|string} dateTime - DateTime to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(dateTime) {
  const d = new Date(dateTime);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

- [ ] **Step 3: Remove `isOverdue` (lines 35–42)**

```js
/**
 * Check if a reminder is overdue
 * @param {string} dateTime - Reminder datetime
 * @returns {boolean} True if overdue
 */
export function isOverdue(dateTime) {
  return new Date(dateTime) < new Date();
}
```

- [ ] **Step 4: Remove `getCategoryColor` (lines 44–57)**

```js
/**
 * Get category badge color
 * @param {string} category - Category name
 * @returns {string} Tailwind CSS classes for badge
 */
export function getCategoryColor(category) {
  const colors = {
    work: "bg-primary-light text-primary",
    personal: "bg-success-light text-success",
    health: "bg-danger-light text-danger",
    other: "bg-background-tertiary text-text-secondary",
  };
  return colors[category] || colors.other;
}
```

- [ ] **Step 5: Remove `getCategoryIndicatorColor` (lines 59–67)**

```js
export function getCategoryIndicatorColor(category) {
  const colors = {
    work: "bg-primary",
    personal: "bg-success",
    health: "bg-danger",
    other: "bg-text-muted",
  };
  return colors[category] || colors.other;
}
```

- [ ] **Step 6: Remove `validateReminder` (lines 69–97)**

```js
/**
 * Validate reminder data
 * @param {Object} data - Reminder data
 * @returns {Object} Validation result with isValid and errors
 */
export function validateReminder(data) {
  const errors = {};
  if (!data.title || data.title.trim() === "") {
    errors.title = "Title is required";
  }
  if (!data.dateTime) {
    errors.dateTime = "Date and time are required";
  }
  if (!data.category) {
    errors.category = "Category is required";
  }
  if (data.recurring && !data.recurringType) {
    errors.recurringType = "Recurring type is required for recurring reminders";
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
```

- [ ] **Step 7: Remove `generateId` (lines 99–105)**

```js
/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
```

- [ ] **Step 8: Remove `validateTag` (lines 182–204)**

```js
/**
 * Validate a single tag
 * @param {string} tag - Tag to validate
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateTag(tag) {
  const normalized = normalizeTag(tag);
  if (normalized.length < 2) {
    return { isValid: false, error: "Tag must be at least 2 characters" };
  }
  if (normalized.length > 30) {
    return { isValid: false, error: "Tag must be 30 characters or less" };
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return {
      isValid: false,
      error: "Tag can only contain letters, numbers, and hyphens",
    };
  }
  return { isValid: true };
}
```

- [ ] **Step 9: Remove `categoryToTag` (lines 235–248)**

```js
/**
 * Convert legacy category to tag
 * @param {string} category - Legacy category (work, personal, health, other)
 * @returns {string} Tag equivalent
 */
export function categoryToTag(category) {
  const mapping = {
    work: "work",
    personal: "personal",
    health: "health",
    other: "general",
  };
  return mapping[category] || "general";
}
```

- [ ] **Step 10: Remove `ensureCategoryTag` (lines 264–279)**

```js
/**
 * Merge tags ensuring category tag exists
 * @param {string[]} tags - User provided tags
 * @param {string} category - Category to ensure exists
 * @returns {string[]} Merged tags with category
 */
export function ensureCategoryTag(tags, category) {
  const normalized = normalizeTags(tags);
  const categoryTag = categoryToTag(category);
  if (!normalized.includes(categoryTag)) {
    return [categoryTag, ...normalized];
  }
  return normalized;
}
```

- [ ] **Step 11: Remove `getPriorityCheckboxColor` (lines 374–377)**

```js
export function getPriorityCheckboxColor(priority) {
  if (priority === "high") return "var(--danger)";
  return "var(--text-muted)";
}
```

- [ ] **Step 12: Remove `getStatusClasses` (lines 409–416)**

```js
/**
 * Get status color classes
 * @param {string} status - Status value
 * @returns {string} Tailwind classes
 */
export function getStatusClasses(status) {
  return getStatusConfig(status).color;
}
```

- [ ] **Step 13: Commit**

```bash
git add lib/utils.js
git commit -m "chore: remove 12 dead functions/constants from lib/utils.js"
```

---

### Task 3: Un-export Internal-Only Symbols in `lib/utils.js`

**Files:**
- Modify: `lib/utils.js`

These symbols are used internally by live exported functions but are never imported directly in production. Remove the `export` keyword to make them module-private.

- [ ] **Step 1: Un-export `getTagColor`**

Change:
```js
export function getTagColor(tag) {
```
To:
```js
function getTagColor(tag) {
```

Reason: Only used by `getTagClasses()` (which IS live).

- [ ] **Step 2: Un-export `STATUS_TRANSITIONS`**

Change:
```js
export const STATUS_TRANSITIONS = {
```
To:
```js
const STATUS_TRANSITIONS = {
```

Reason: Only used by `isValidStatusTransition()` (which IS live).

- [ ] **Step 3: Un-export `STATUS_CONFIG`**

Change:
```js
export const STATUS_CONFIG = {
```
To:
```js
const STATUS_CONFIG = {
```

Reason: Only used by `getStatusConfig()` (which IS live).

- [ ] **Step 4: Un-export `PRIORITY_CONFIG`**

Change:
```js
export const PRIORITY_CONFIG = {
```
To:
```js
const PRIORITY_CONFIG = {
```

Reason: Only used by `getPriorityConfig()` (which IS live).

- [ ] **Step 5: Commit**

```bash
git add lib/utils.js
git commit -m "chore: un-export 4 internal-only symbols in lib/utils.js"
```

---

### Task 4: Fix Miscellaneous Issues

**Files:**
- Modify: `app/api/reminders/route.js:5-13`
- Modify: `app/page.js:31,92`
- Modify: `auth.js:10`

- [ ] **Step 1: Remove unused imports from `app/api/reminders/route.js`**

Change the import block from:
```js
import {
  normalizeTags,
  getMainCategory,
  isValidStatus,
  deriveStatusFromCompleted,
  deriveCompletedFromStatus,
  validateDuration,
  formatDuration
} from "@/lib/utils";
```
To:
```js
import {
  normalizeTags,
  getMainCategory,
  deriveStatusFromCompleted,
  deriveCompletedFromStatus,
  validateDuration,
} from "@/lib/utils";
```

`isValidStatus` and `formatDuration` are imported but never used in this file's body. They remain exported from utils.js for other consumers.

- [ ] **Step 2: Fix broken links in `app/page.js`**

Line 31 — change:
```jsx
<Link href="/reminders/new">
```
To:
```jsx
<Link href="/login">
```

Line 92 — change:
```jsx
<Link href="/reminders/new">
```
To:
```jsx
<Link href="/login">
```

- [ ] **Step 3: Fix CJS require in `auth.js`**

Line 10 — change:
```js
const bcrypt = require("bcryptjs");
```
To:
```js
import bcrypt from "bcryptjs";
```

- [ ] **Step 4: Commit**

```bash
git add app/api/reminders/route.js app/page.js auth.js
git commit -m "chore: remove unused imports, fix broken links, convert require to import"
```

---

### Task 5: Clean Tests

**Files:**
- Modify: `tests/utils.test.js`

- [ ] **Step 1: Update import statement**

Change:
```js
import {
  normalizeTag,
  normalizeTags,
  validateTag,
  getMainCategory,
  categoryToTag,
  ensureCategoryTag,
  isValidStatus,
  isValidStatusTransition,
  deriveStatusFromCompleted,
  deriveCompletedFromStatus,
  validateDuration,
  formatDuration,
  calculateEndTime,
  hasTimeOverlap,
  REMINDER_STATUSES,
  STATUS_TRANSITIONS,
} from "@/lib/utils.js";
```
To:
```js
import {
  normalizeTag,
  normalizeTags,
  getMainCategory,
  isValidStatus,
  isValidStatusTransition,
  deriveStatusFromCompleted,
  deriveCompletedFromStatus,
  validateDuration,
  formatDuration,
  calculateEndTime,
  hasTimeOverlap,
  REMINDER_STATUSES,
} from "@/lib/utils.js";
```

Removed: `validateTag`, `categoryToTag`, `ensureCategoryTag`, `STATUS_TRANSITIONS` (all deleted or un-exported).

- [ ] **Step 2: Remove `describe("validateTag", ...)` block (lines 77–86)**

```js
describe("validateTag", () => {
  it("accepts valid tag", () => {
    expect(validateTag("work")).toEqual({ isValid: true });
  });
  it("rejects too short tag", () => {
    const result = validateTag("a");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("2 characters");
  });
});
```

- [ ] **Step 3: Remove `describe("categoryToTag", ...)` block (lines 109–118)**

```js
describe("categoryToTag", () => {
  it("maps known categories", () => {
    expect(categoryToTag("work")).toBe("work");
    expect(categoryToTag("health")).toBe("health");
    expect(categoryToTag("other")).toBe("general");
  });
  it("defaults to general for unknown", () => {
    expect(categoryToTag("xyz")).toBe("general");
  });
});
```

- [ ] **Step 4: Remove `describe("ensureCategoryTag", ...)` block (lines 120–130)**

```js
describe("ensureCategoryTag", () => {
  it("adds category tag if missing", () => {
    const result = ensureCategoryTag(["urgent"], "work");
    expect(result).toContain("work");
    expect(result).toContain("urgent");
  });
  it("does not duplicate if already present", () => {
    const result = ensureCategoryTag(["work", "urgent"], "work");
    expect(result.filter((t) => t === "work").length).toBe(1);
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add tests/utils.test.js
git commit -m "test: remove test cases for deleted/un-exported utils functions"
```

---

### Task 6: Verify

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with zero errors. Warnings are acceptable.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All remaining tests pass.

- [ ] **Step 3: If either fails, investigate and fix**

Read the error message. The most likely failure mode is a missed import of a deleted function somewhere. Fix the specific breakage, then re-run.
