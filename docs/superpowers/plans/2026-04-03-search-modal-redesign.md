# Search Modal Redesign — Dense Minimal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the search modal (command palette) with a Linear-inspired dense minimal aesthetic — dark and light modes, status dots, keyboard footer, tighter spacing.

**Architecture:** Pure visual change across two files. CSS custom properties scoped to `.cmdk-panel` provide theme tokens. JSX restructured to use inline SVG icons and status dots instead of react-icons. No logic, routing, or data-fetching changes.

**Tech Stack:** React (cmdk), CSS custom properties, SVG inline icons

**Spec:** `docs/superpowers/specs/2026-04-03-search-modal-redesign.md`

---

### Task 1: Add cmdk theme tokens to CSS

**Files:**
- Modify: `app/globals.css:12-125` (`:root` and `.dark` blocks)

- [ ] **Step 1: Add cmdk tokens inside `:root` (light mode)**

Add these variables at the end of the `:root` block (before the closing `}`), after the existing modal variables around line 121:

```css
    /* Command palette (search modal) */
    --cmdk-bg: #ffffff;
    --cmdk-border: #e5e5e5;
    --cmdk-surface-hover: #f7f7f7;
    --cmdk-divider: #f0f0f0;
    --cmdk-text-primary: #333333;
    --cmdk-text-secondary: #555555;
    --cmdk-text-muted: #999999;
    --cmdk-text-faint: #aaaaaa;
    --cmdk-date: #bbbbbb;
    --cmdk-kbd-bg: #f5f5f5;
    --cmdk-kbd-border: #e5e5e5;
    --cmdk-overlay: rgba(0, 0, 0, 0.3);
    --cmdk-shadow: 0 16px 48px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
```

- [ ] **Step 2: Add cmdk tokens inside `.dark` block**

Add these variables at the end of the `.dark` block (before the closing `}`):

```css
    /* Command palette (search modal) */
    --cmdk-bg: #0a0a0a;
    --cmdk-border: #1a1a1a;
    --cmdk-surface-hover: #111111;
    --cmdk-divider: #141414;
    --cmdk-text-primary: #cccccc;
    --cmdk-text-secondary: #999999;
    --cmdk-text-muted: #555555;
    --cmdk-text-faint: #333333;
    --cmdk-date: #333333;
    --cmdk-kbd-bg: transparent;
    --cmdk-kbd-border: #222222;
    --cmdk-overlay: rgba(0, 0, 0, 0.6);
    --cmdk-shadow: none;
```

- [ ] **Step 3: Run lint to verify syntax**

Run: `npx next lint --file app/globals.css`
Expected: No errors (CSS variables are valid syntax)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "style: add cmdk theme tokens for search modal redesign"
```

---

### Task 2: Rewrite cmdk styles in CSS

**Files:**
- Modify: `app/globals.css:588-691` (the `/* cmdk - Command Palette */` section)

- [ ] **Step 1: Replace the entire cmdk CSS block**

Replace everything from line 588 (`/* cmdk - Command Palette */`) through line 691 (`[cmdk-separator]` closing `}`) with:

```css
/* cmdk - Command Palette */
[cmdk-overlay] {
  position: fixed;
  inset: 0;
  background: var(--cmdk-overlay);
  backdrop-filter: blur(4px);
  z-index: 50;
}

[cmdk-dialog] {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  padding-top: 15vh;
  pointer-events: none;
}

.cmdk-panel {
  pointer-events: auto;
  width: 100%;
  max-width: 32rem;
  margin: 0 1rem;
  background: var(--cmdk-bg);
  border: 1px solid var(--cmdk-border);
  border-radius: 0.75rem;
  box-shadow: var(--cmdk-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  animation: cmdk-enter 150ms ease-out;
}

@keyframes cmdk-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cmdk-panel {
    animation: cmdk-enter-reduced 150ms ease-out;
  }
  @keyframes cmdk-enter-reduced {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}

.cmdk-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--cmdk-divider);
}

.cmdk-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  color: var(--cmdk-text-primary);
}

.cmdk-input::placeholder {
  color: var(--cmdk-text-muted);
}

.cmdk-kbd {
  font-size: 0.5625rem;
  font-family: ui-monospace, monospace;
  padding: 0.125rem 0.375rem;
  border-radius: 0.1875rem;
  background: var(--cmdk-kbd-bg);
  border: 1px solid var(--cmdk-kbd-border);
  color: var(--cmdk-text-faint);
  flex-shrink: 0;
}

.cmdk-list {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.25rem 0.375rem;
}

.cmdk-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.625rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 100ms ease;
}

[cmdk-item][data-selected="true"] {
  background: var(--cmdk-surface-hover);
}

[cmdk-item][data-selected="true"] .cmdk-item-title {
  color: var(--cmdk-text-primary);
}

[cmdk-group-heading] {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--cmdk-text-faint);
  padding: 0.5rem 0.625rem 0.25rem;
}

[cmdk-empty] {
  padding: 0;
}

[cmdk-separator] {
  height: 1px;
  background: var(--cmdk-divider);
  margin: 0.125rem 1rem;
}

.cmdk-footer {
  border-top: 1px solid var(--cmdk-divider);
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cmdk-footer-hint {
  font-size: 0.625rem;
  color: var(--cmdk-text-faint);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.cmdk-footer-hint kbd {
  font-family: ui-monospace, monospace;
  font-size: 0.5625rem;
  border: 1px solid var(--cmdk-kbd-border);
  border-radius: 0.1875rem;
  padding: 0 0.25rem;
  background: var(--cmdk-kbd-bg);
  color: var(--cmdk-text-faint);
}

.cmdk-divider {
  height: 1px;
  background: var(--cmdk-divider);
  margin: 0.125rem 1rem;
}

.cmdk-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cmdk-item-title {
  color: var(--cmdk-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
}

.cmdk-item-date {
  color: var(--cmdk-date);
  font-size: 0.625rem;
  flex-shrink: 0;
}

.cmdk-skeleton {
  height: 32px;
  border-radius: 0.375rem;
  background: var(--cmdk-surface-hover);
  animation: cmdk-pulse 1.5s ease-in-out infinite;
}

@keyframes cmdk-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
```

- [ ] **Step 2: Run lint to verify syntax**

Run: `npx next lint --file app/globals.css`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: rewrite cmdk styles for dense minimal design"
```

---

### Task 3: Rewrite GlobalSearch.js component

**Files:**
- Modify: `components/search/GlobalSearch.js`

- [ ] **Step 1: Replace the entire GlobalSearch.js file**

Replace the full file content with:

```jsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { getTagClasses } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";

const CACHE_TTL = 30_000; // 30 seconds

const STATUS_COLORS = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  snoozed: "#a855f7",
};

function SearchIcon({ className }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="6.5" cy="6.5" r="5" />
      <line x1="10" y1="10" x2="13.5" y2="13.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="6.5" y1="2" x2="6.5" y2="11" />
      <line x1="2" y1="6.5" x2="11" y2="6.5" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="2" y="2" width="9" height="9" rx="2" />
      <line x1="5" y1="6.5" x2="8" y2="6.5" />
    </svg>
  );
}

function StatusDot({ status }) {
  return (
    <div
      className="cmdk-status-dot"
      style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.pending }}
    />
  );
}

function HighlightText({ text, search }) {
  if (!search || !text) return text;
  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) => {
      regex.lastIndex = 0;
      return regex.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-300/40 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5"
        >
          {part}
        </mark>
      ) : (
        part
      );
    });
  } catch {
    return text;
  }
}

export default function GlobalSearch() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("search");
  const tNav = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const cacheRef = useRef({ data: null, timestamp: 0 });

  // Ctrl+K / Cmd+K shortcut — skip inside inputs
  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        const tag = document.activeElement?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          document.activeElement?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch reminders on open with cache
  useEffect(() => {
    if (!open) {
      setSearchValue("");
      return;
    }

    const now = Date.now();
    if (cacheRef.current.data && now - cacheRef.current.timestamp < CACHE_TTL) {
      setReminders(cacheRef.current.data);
      return;
    }

    const fetchReminders = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/reminders");
        const data = await response.json();
        if (data.success) {
          setReminders(data.data);
          cacheRef.current = { data: data.data, timestamp: Date.now() };
        }
      } catch (err) {
        console.error("Error fetching reminders:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReminders();
  }, [open]);

  const handleSelect = useCallback(
    (id) => {
      setOpen(false);
      router.push(`/reminders/${id}`);
    },
    [router],
  );

  // Status-based grouping
  const upcoming = reminders.filter(
    (r) => r.status !== "completed" && r.status !== "snoozed",
  );
  const snoozed = reminders.filter((r) => r.status === "snoozed");
  const completed = reminders.filter((r) => r.status === "completed");

  const isBrowsing = !searchValue;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center gap-1.5"
        aria-label="Search reminders (Ctrl+K)"
        aria-keyshortcuts="Meta+K"
      >
        <SearchIcon className="w-4 h-4" />
        <span className="hidden sm:inline">{tNav("search")}</span>
      </button>

      {/* Command palette */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label={t("title")}
        loop
      >
        {/* Accessible title (visually hidden) */}
        <DialogPrimitive.Title className="sr-only">
          {t("title")}
        </DialogPrimitive.Title>
        {/* Overlay */}
        <div className="cmdk-overlay" onClick={() => setOpen(false)} />

        <div className="cmdk-panel">
          {/* Input */}
          <div className="cmdk-input-wrapper">
            <SearchIcon style={{ color: "var(--cmdk-text-muted)" }} />
            <Command.Input
              data-testid="global-search-input"
              placeholder={t("placeholder")}
              className="cmdk-input"
              onValueChange={setSearchValue}
            />
            <kbd className="cmdk-kbd">⌘K</kbd>
          </div>

          {/* Results */}
          <Command.List className="cmdk-list">
            {loading && (
              <Command.Loading>
                <div className="flex flex-col gap-1 p-1.5">
                  <div className="cmdk-skeleton" />
                  <div className="cmdk-skeleton" />
                  <div className="cmdk-skeleton" />
                </div>
              </Command.Loading>
            )}

            <Command.Empty>
              <div
                className="py-6 text-center"
                style={{
                  color: "var(--cmdk-text-muted)",
                  fontSize: "0.8125rem",
                }}
              >
                {t("noResults")}
              </div>
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading={t("quickActions")}>
              <Command.Item
                value="create new reminder 建立新提醒"
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("open-ai-modal"));
                }}
                className="cmdk-item"
              >
                <PlusIcon />
                <span className="cmdk-item-title">{t("createNew")}</span>
              </Command.Item>
              <Command.Item
                value="open AI assistant AI 助手"
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("open-ai-modal"));
                }}
                className="cmdk-item"
              >
                <AiIcon />
                <span className="cmdk-item-title">{t("aiAssistant")}</span>
              </Command.Item>
            </Command.Group>

            {/* Divider between actions and reminders */}
            {(upcoming.length > 0 ||
              snoozed.length > 0 ||
              completed.length > 0) && <div className="cmdk-divider" />}

            {/* Upcoming / In Progress */}
            {upcoming.length > 0 && (
              <Command.Group heading={t("inProgress")}>
                {upcoming.slice(0, 6).map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                    keywords={r.tags}
                    onSelect={() => handleSelect(r.id)}
                    className="cmdk-item"
                  >
                    <StatusDot status={r.status} />
                    <span className="cmdk-item-title flex-1 min-w-0 truncate">
                      <HighlightText text={r.title} search={searchValue} />
                    </span>
                    <span className="cmdk-item-date">
                      {formatDateShort(r.dateTime, locale)}
                    </span>
                    {isBrowsing && r.tags?.[0] && (
                      <span
                        className={`px-1.5 py-0 rounded text-[10px] font-medium flex-shrink-0 ${getTagClasses(r.tags[0])}`}
                      >
                        {r.tags[0]}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Snoozed */}
            {snoozed.length > 0 && (
              <>
                {upcoming.length > 0 && <div className="cmdk-divider" />}
                <Command.Group heading={t("snoozed")}>
                  {snoozed.slice(0, 3).map((r) => (
                    <Command.Item
                      key={r.id}
                      value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                      keywords={r.tags}
                      onSelect={() => handleSelect(r.id)}
                      className="cmdk-item"
                    >
                      <StatusDot status="snoozed" />
                      <span className="cmdk-item-title flex-1 min-w-0 truncate">
                        <HighlightText text={r.title} search={searchValue} />
                      </span>
                      <span className="cmdk-item-date">
                        {t("snoozedUntil", {
                          date: formatDateShort(r.snoozedUntil, locale),
                        })}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <>
                {(upcoming.length > 0 || snoozed.length > 0) && (
                  <div className="cmdk-divider" />
                )}
                <Command.Group heading={t("completed")}>
                  {completed.slice(0, 4).map((r) => (
                    <Command.Item
                      key={r.id}
                      value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                      keywords={r.tags}
                      onSelect={() => handleSelect(r.id)}
                      className="cmdk-item"
                    >
                      <StatusDot status="completed" />
                      <span className="cmdk-item-title flex-1 min-w-0 truncate">
                        <HighlightText text={r.title} search={searchValue} />
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}
          </Command.List>

          {/* Footer with keyboard hints */}
          <div className="cmdk-footer">
            <span className="cmdk-footer-hint">
              <kbd>↑↓</kbd> navigate
            </span>
            <span className="cmdk-footer-hint">
              <kbd>↵</kbd> open
            </span>
            <span className="cmdk-footer-hint">
              <kbd>esc</kbd> close
            </span>
          </div>
        </div>
      </Command.Dialog>
    </>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npx next lint --file components/search/GlobalSearch.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/search/GlobalSearch.js
git commit -m "feat: redesign search modal with dense minimal style"
```

---

### Task 4: Verify — visual check and E2E tests

**Files:**
- Read: `e2e/search.spec.js` (no modifications — existing tests validate selectors)

- [ ] **Step 1: Start dev server if not running**

Run: `npm run dev`
Expected: Server running on port 3000

- [ ] **Step 2: Manual visual verification**

Open `http://localhost:3000/dashboard` in browser. Press `⌘K`. Verify:
1. Modal opens with slide-up + fade-in animation
2. Search input shows `⌘K` badge (not ESC)
3. Quick actions show SVG stroke icons (plus, rectangle)
4. Group headers are uppercase, small, faint
5. Reminder items show colored dots (not icons)
6. Tags show only first tag, only when not searching
7. Dividers appear between sections (inset, not full-width)
8. Footer shows `↑↓ navigate`, `↵ open`, `esc close`
9. Arrow keys navigate items, selected item gets subtle background
10. Toggle light/dark mode — both look correct

- [ ] **Step 3: Run existing E2E tests**

Run: `npx playwright test --config e2e/playwright.config.js e2e/search.spec.js`
Expected: All 3 tests pass (they test `data-testid="global-search-input"` and `[cmdk-item]` which are preserved)

- [ ] **Step 4: Run full test suite to check for regressions**

Run: `npm run test`
Expected: All tests pass (no unit tests directly test GlobalSearch)

- [ ] **Step 5: Commit (only if any fix was needed)**

```bash
git add -A
git commit -m "fix: address search modal visual issues from verification"
```
