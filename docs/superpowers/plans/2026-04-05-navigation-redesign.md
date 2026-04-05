# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign navigation from 5-tab flat layout to responsive 4-tab mobile bottom nav + desktop sidebar, with capture-first Inbox and Notes list view.

**Architecture:** Mobile uses a 4-tab fixed bottom nav (Inbox/Today/Calendar/Notes). Desktop replaces the horizontal nav links in Navbar with a persistent left sidebar (210px). The locale layout conditionally renders sidebar vs bottom nav at the md breakpoint. Inbox becomes a capture-first surface reusing the existing parse-task API.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS 4, next-intl 4, React Query, react-icons, Lucide React

**Branch:** `UI-design`

**Spec:** `docs/superpowers/specs/2026-04-05-navigation-redesign.md`

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `components/layout/BottomNav.js` | Mobile 4-tab bottom nav | Modify |
| `components/layout/Navbar.js` | Slim utility top bar (no nav links on desktop) | Modify |
| `components/layout/Sidebar.js` | Desktop persistent sidebar navigation | Create |
| `app/[locale]/layout.js` | Conditional sidebar/bottom-nav rendering | Modify |
| `app/[locale]/(app)/inbox/page.js` | Capture-first inbox with mixed feed | Rewrite |
| `app/[locale]/(app)/notes/page.js` | Notes list with preview + FAB | Rewrite |
| `components/notes/NotesLayout.js` | Adjust for new notes index flow | Modify |
| `components/inbox/CaptureInput.js` | Free-form text input with AI parse | Create |
| `components/inbox/SuggestionBar.js` | Inline AI task suggestion display | Create |
| `components/inbox/RecentFeed.js` | Mixed tasks + notes feed | Create |
| `lib/notes/preview.js` | Extract preview text from BlockNote content | Create |
| `messages/en.json` | New translation keys | Modify |
| `messages/zh-TW.json` | New translation keys | Modify |

---

### Task 1: Update BottomNav — 5 tabs to 4 tabs

**Files:**
- Modify: `components/layout/BottomNav.js`

- [ ] **Step 1: Update TABS config**

Change the TABS array from 5 to 4 items. Remove the `/reminders` (All) entry. Reorder so Inbox is first.

```javascript
// In BottomNav.js, replace the TABS array (lines 15-21)
const TABS = [
  { href: "/inbox", icon: FaInbox, labelKey: "inbox" },
  { href: "/dashboard", icon: FaHome, labelKey: "today" },
  { href: "/calendar", icon: FaCalendarAlt, labelKey: "calendar" },
  { href: "/notes", icon: FaStickyNote, labelKey: "notes" },
];
```

Also remove `FaList` from the imports since the All tab is gone.

- [ ] **Step 2: Fix semantic roles**

Replace `role="tablist"` with `role="navigation"` and `role="tab"` with nothing (plain links). The bottom nav is navigation, not a tabbed interface.

```javascript
// Change the nav container (around line 65):
// Old: role="tablist" aria-label={t("mainNavigation")}
// New: role="navigation" aria-label={t("mainNavigation")}

// Change each Link (around line 88):
// Old: role="tab" aria-selected={isActive} aria-current={isActive ? "page" : undefined}
// New: aria-current={isActive ? "page" : undefined}
// Remove role="tab" and aria-selected entirely
```

- [ ] **Step 3: Increase label font size**

Change label text from `text-[10px]` to `text-[11px]` for better readability.

```javascript
// Around line 109, update the label span:
// Old: className="text-[10px] ..."
// New: className="text-[11px] ..."
```

- [ ] **Step 4: Update pill indicator width calculation**

The pill width is calculated based on TABS.length. With 4 tabs, each tab is 25% width. Verify the left offset calculation uses TABS.length correctly (it does — `activeIndex * (100 / TABS.length)`). Just confirm the animation still looks right.

- [ ] **Step 5: Verify active detection still works**

The `getActiveIndex` function has special logic for `/dashboard` (exact match). Since we moved Inbox to index 0 and dashboard to index 1, verify:
- `/inbox` → index 0 (prefix match)
- `/dashboard` → index 1 (exact match)
- `/calendar` → index 2 (prefix match)
- `/notes` → index 3 (prefix match)
- `/notes/some-id` → index 3 (prefix match, correct)

No code change needed — the existing logic handles this.

- [ ] **Step 6: Run dev server and test**

Run: `npm run dev`

Verify on mobile viewport (375px):
- 4 tabs visible: Inbox, Today, Calendar, Notes
- Active pill animates correctly
- Tapping each tab navigates properly
- No `/reminders` tab visible

- [ ] **Step 7: Commit**

```bash
git add components/layout/BottomNav.js
git commit -m "refactor: update BottomNav from 5 to 4 tabs, fix semantics"
```

---

### Task 2: Create Sidebar component

**Files:**
- Create: `components/layout/Sidebar.js`

- [ ] **Step 1: Create the Sidebar component**

```javascript
"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  FaInbox,
  FaHome,
  FaCalendarAlt,
  FaStickyNote,
  FaList,
} from "react-icons/fa";

const PRIMARY_ITEMS = [
  { href: "/inbox", icon: FaInbox, labelKey: "inbox" },
  { href: "/dashboard", icon: FaHome, labelKey: "today" },
  { href: "/calendar", icon: FaCalendarAlt, labelKey: "calendar" },
];

const WORKSPACE_ITEMS = [
  { href: "/notes", icon: FaStickyNote, labelKey: "notes" },
  { href: "/reminders", icon: FaList, labelKey: "all" },
];

function isActive(pathname, href) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { data: session } = useSession();

  const renderItem = ({ href, icon: Icon, labelKey }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`
          relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium
          transition-colors duration-150
          ${active
            ? "bg-[var(--primary-light)] text-[var(--primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          }
        `}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm"
            style={{ backgroundColor: "var(--primary)" }}
          />
        )}
        <Icon size={16} aria-hidden="true" />
        <span>{t(labelKey)}</span>
      </Link>
    );
  };

  return (
    <aside
      className="hidden md:flex flex-col w-[210px] flex-shrink-0 border-r"
      style={{
        backgroundColor: "var(--navbar-bg)",
        borderColor: "var(--navbar-border)",
      }}
      role="navigation"
      aria-label={t("mainNavigation")}
    >
      <nav className="flex-1 px-2.5 py-4 space-y-1">
        {PRIMARY_ITEMS.map(renderItem)}

        <div
          className="pt-4 pb-1.5 px-3 text-[10px] font-medium uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Workspace
        </div>

        {WORKSPACE_ITEMS.map(renderItem)}
      </nav>

      {session?.user && (
        <div
          className="px-3 py-3 border-t"
          style={{ borderColor: "var(--navbar-border)" }}
        >
          <div className="flex items-center gap-2.5 px-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold"
              style={{
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              {(session.user.name || "U")[0].toUpperCase()}
            </div>
            <span
              className="text-[12.5px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {session.user.name}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Verify the component renders in isolation**

Temporarily import and render in the locale layout to confirm it shows on desktop and hides on mobile. Check at 768px breakpoint.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.js
git commit -m "feat: add desktop Sidebar navigation component"
```

---

### Task 3: Simplify Navbar for new app shell

**Files:**
- Modify: `components/layout/Navbar.js`

- [ ] **Step 1: Remove desktop nav links**

The 5 horizontal nav links in Navbar (lines 86-127) are only shown on `md:` screens. Since the Sidebar now handles desktop navigation, remove these links entirely.

Delete the block from `{/* Navigation links */}` through the closing `</div>` of the nav links container. This removes the `FaHome, FaInbox, FaCalendarAlt, FaList, FaStickyNote` usage from Navbar — clean up those imports too.

Keep everything else: logo, GlobalSearch, NotificationBell, locale switcher, theme toggle, user section.

- [ ] **Step 2: Adjust layout for utility bar**

The remaining utility items (search, notifications, theme, locale, account) should spread across the full width since nav links are gone. The existing flex layout already handles this — just verify the spacing looks right without the nav links section.

- [ ] **Step 3: Run dev and check**

Run: `npm run dev`

Verify:
- Desktop (>=768px): Navbar shows logo + search + notification + theme/locale + account. No nav links.
- Mobile (<768px): Navbar unchanged (nav links were already hidden on mobile).

- [ ] **Step 4: Commit**

```bash
git add components/layout/Navbar.js
git commit -m "refactor: remove desktop nav links from Navbar (handled by Sidebar)"
```

---

### Task 4: Restructure locale layout — app shell

**Files:**
- Modify: `app/[locale]/layout.js`

- [ ] **Step 1: Import Sidebar**

```javascript
import Sidebar from "@/components/layout/Sidebar";
```

- [ ] **Step 2: Update the body structure**

Change the layout from linear (Navbar → main → BottomNav) to a flex layout that puts Sidebar next to main on desktop.

```jsx
<body className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col bg-background`}>
  <ThemeProvider>
    <NextIntlClientProvider messages={messages}>
      <Providers>
        <a href="#main-content" className="skip-to-content">{tMeta("skipToContent")}</a>
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main id="main-content" className="flex-1 w-full pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0">
            {children}
          </main>
        </div>
        <BottomNav />
        <Footer />
      </Providers>
    </NextIntlClientProvider>
  </ThemeProvider>
</body>
```

Key changes:
- Wrap `<Sidebar />` + `<main>` in a `<div className="flex flex-1">` so they sit side-by-side
- Sidebar is `hidden md:flex` (handles its own responsive hiding)
- main keeps the existing `pb-[calc(...)]` for mobile bottom nav padding, `md:pb-0` for desktop
- Navbar stays above everything
- BottomNav stays below everything (already `md:hidden`)

- [ ] **Step 3: Run dev and test both breakpoints**

Run: `npm run dev`

Test at 375px (mobile):
- Navbar at top (no nav links)
- Content area fills screen
- Bottom nav shows 4 tabs
- No sidebar visible

Test at 1024px (desktop):
- Navbar at top (utility bar only)
- Sidebar on left (210px)
- Content area takes remaining width
- No bottom nav
- Sidebar active state matches current route

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/layout.js
git commit -m "feat: restructure app shell with sidebar + conditional bottom nav"
```

---

### Task 5: Create extractPreview utility for notes

**Files:**
- Create: `lib/notes/preview.js`
- Create: `tests/unit/notes-preview.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/notes-preview.test.js
import { describe, it, expect } from "vitest";
import { extractPreview } from "@/lib/notes/preview";

describe("extractPreview", () => {
  it("returns empty string for empty content", () => {
    expect(extractPreview([])).toBe("");
    expect(extractPreview(null)).toBe("");
    expect(extractPreview(undefined)).toBe("");
  });

  it("extracts text from paragraph blocks", () => {
    const content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello world" }],
      },
    ];
    expect(extractPreview(content)).toBe("Hello world");
  });

  it("joins multiple blocks with space", () => {
    const content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "First line" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Second line" }],
      },
    ];
    expect(extractPreview(content)).toBe("First line Second line");
  });

  it("truncates to maxLength", () => {
    const content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "A".repeat(200) }],
      },
    ];
    const result = extractPreview(content, 80);
    expect(result.length).toBeLessThanOrEqual(83); // 80 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("handles nested inline content", () => {
    const content = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world", styles: { bold: true } },
        ],
      },
    ];
    expect(extractPreview(content)).toBe("Hello world");
  });

  it("handles heading blocks", () => {
    const content = [
      {
        type: "heading",
        content: [{ type: "text", text: "Title" }],
      },
    ];
    expect(extractPreview(content)).toBe("Title");
  });

  it("handles blocks with no content array", () => {
    const content = [
      { type: "image", props: { url: "test.png" } },
      {
        type: "paragraph",
        content: [{ type: "text", text: "After image" }],
      },
    ];
    expect(extractPreview(content)).toBe("After image");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/unit/notes-preview.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```javascript
// lib/notes/preview.js

/**
 * Extract plain text preview from BlockNote content array.
 * Walks the block tree and concatenates text nodes.
 */
export function extractPreview(content, maxLength = 80) {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return "";
  }

  const texts = [];

  for (const block of content) {
    if (!block.content || !Array.isArray(block.content)) continue;
    for (const inline of block.content) {
      if (inline.type === "text" && inline.text) {
        texts.push(inline.text);
      }
    }
  }

  const joined = texts.join(" ").trim();

  if (joined.length <= maxLength) return joined;
  return joined.slice(0, maxLength) + "...";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/unit/notes-preview.test.js`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/notes/preview.js tests/unit/notes-preview.test.js
git commit -m "feat: add extractPreview utility for BlockNote content"
```

---

### Task 6: Rewrite Notes list view page

**Files:**
- Modify: `app/[locale]/(app)/notes/page.js`

- [ ] **Step 1: Rewrite notes page as a list view**

Replace the current page (which redirects to first note) with a list view that shows all notes with preview text.

```javascript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FiFileText, FiPlus, FiClock } from "react-icons/fi";
import { extractPreview } from "@/lib/notes/preview";

export default function NotesPage() {
  const t = useTranslations("notes");
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setNotes(data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t("untitled") }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/notes/${data.data.id}`);
      }
    } catch {
      // silently fail
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t("editedAgo", { time: "just now" });
    if (diffMin < 60) return t("editedAgo", { time: `${diffMin}m` });
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return t("editedAgo", { time: `${diffHours}h` });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t("editedAgo", { time: `${diffDays}d` });
    return t("editedAgo", { time: date.toLocaleDateString() });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h1>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FiFileText size={32} className="mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            {t("emptyState")}
          </p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--primary-light)",
              color: "var(--primary)",
            }}
          >
            {t("emptyStateAction")}
          </button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => router.push(`/notes/${note.id}`)}
              className="w-full text-left p-3 rounded-lg transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div className="flex items-center gap-2 mb-1">
                <FiFileText size={14} style={{ color: "var(--text-muted)" }} />
                <span className="font-semibold text-[13.5px]">
                  {note.title || t("untitled")}
                </span>
              </div>
              <p
                className="text-[11.5px] line-clamp-2 ml-[22px]"
                style={{ color: "var(--text-muted)" }}
              >
                {extractPreview(note.content)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 ml-[22px]">
                <FiClock size={10} style={{ color: "var(--text-muted)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {formatTime(note.updatedAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FAB — mobile only, desktop uses sidebar "New Page" */}
      {notes.length > 0 && (
        <button
          onClick={handleCreate}
          className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 z-40"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--text-inverted)",
            boxShadow: "0 4px 16px rgba(91,141,239,0.3)",
          }}
          aria-label={t("newPage")}
        >
          <FiPlus size={20} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run dev and test**

Run: `npm run dev`

Navigate to `/notes`:
- Shows list of notes with title, preview, timestamp
- Empty state if no notes
- Clicking a note navigates to `/notes/{id}` (existing editor)
- FAB creates new note and navigates to it
- FAB positioned above bottom nav on mobile

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/notes/page.js
git commit -m "feat: rewrite Notes page as browseable list with preview"
```

---

### Task 7: Create CaptureInput component

**Files:**
- Create: `components/inbox/CaptureInput.js`

- [ ] **Step 1: Create the component**

This is the free-form text input at the top of Inbox. It calls `/api/ai/parse-task` after a debounce and shows SuggestionBar when a task is detected.

```javascript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";

const DEBOUNCE_MS = 800;

export default function CaptureInput({ onTaskDetected, onDismiss }) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const parseText = useCallback(
    async (input) => {
      if (!input.trim() || input.trim().length < 3) {
        setParsedResult(null);
        return;
      }

      if (dismissed.has(input.trim())) return;

      setIsParsing(true);
      try {
        const res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: input,
            language: locale === "zh-TW" ? "zh" : "en",
          }),
        });
        const data = await res.json();
        if (data.success && data.data.confidence?.title >= 0.6) {
          setParsedResult(data.data);
        } else {
          setParsedResult(null);
        }
      } catch {
        setParsedResult(null);
      } finally {
        setIsParsing(false);
      }
    },
    [locale, dismissed]
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parseText(value), DEBOUNCE_MS);
  };

  const handleAdd = () => {
    if (parsedResult) {
      onTaskDetected({ ...parsedResult, rawText: text });
      setText("");
      setParsedResult(null);
    }
  };

  const handleDismissSuggestion = () => {
    setDismissed((prev) => new Set(prev).add(text.trim()));
    setParsedResult(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && parsedResult) {
      e.preventDefault();
      handleAdd();
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    text,
    setText,
    isParsing,
    parsedResult,
    handleChange,
    handleAdd,
    handleDismissSuggestion,
    handleKeyDown,
    inputRef,
  };
}
```

Wait — this should be a UI component, not just a hook. Let me restructure. The CaptureInput should render the actual input element and pass results up via callbacks.

```javascript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import SuggestionBar from "./SuggestionBar";

const DEBOUNCE_MS = 800;

export default function CaptureInput({ onTaskAdded }) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const debounceRef = useRef(null);

  const parseText = useCallback(
    async (input) => {
      if (!input.trim() || input.trim().length < 3) {
        setParsedResult(null);
        return;
      }
      if (dismissed.has(input.trim())) return;

      setIsParsing(true);
      try {
        const res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: input,
            language: locale === "zh-TW" ? "zh" : "en",
          }),
        });
        const data = await res.json();
        if (data.success && data.data.confidence?.title >= 0.6) {
          setParsedResult(data.data);
        } else {
          setParsedResult(null);
        }
      } catch {
        setParsedResult(null);
      } finally {
        setIsParsing(false);
      }
    },
    [locale, dismissed]
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parseText(value), DEBOUNCE_MS);
  };

  const handleAdd = () => {
    if (!parsedResult) return;
    onTaskAdded({ ...parsedResult, rawText: text });
    setText("");
    setParsedResult(null);
  };

  const handleDismiss = () => {
    setDismissed((prev) => new Set(prev).add(text.trim()));
    setParsedResult(null);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mb-3">
      <div
        className="rounded-xl px-4 py-3 transition-colors"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <input
          type="text"
          value={text}
          onChange={handleChange}
          placeholder={t("quickCapture")}
          className="w-full bg-transparent text-[14px] outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        {isParsing && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {t("parsing")}
          </div>
        )}
      </div>
      {parsedResult && (
        <SuggestionBar
          result={parsedResult}
          onAdd={handleAdd}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p components/inbox
git add components/inbox/CaptureInput.js
git commit -m "feat: add CaptureInput component for Inbox capture surface"
```

---

### Task 8: Create SuggestionBar component

**Files:**
- Create: `components/inbox/SuggestionBar.js`

- [ ] **Step 1: Create the component**

```javascript
"use client";

import { FiX } from "react-icons/fi";
import { FaMagic } from "react-icons/fa";

export default function SuggestionBar({ result, onAdd, onDismiss }) {
  const parts = [];
  if (result.title) parts.push(result.title);
  if (result.dateTime) {
    const d = new Date(result.dateTime);
    parts.push(
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );
    const hours = d.getHours();
    const mins = d.getMinutes();
    if (hours || mins) {
      parts.push(
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
    }
  }

  return (
    <div
      className="mt-2 mx-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
      style={{
        backgroundColor: "var(--primary-light)",
        border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
        color: "var(--primary)",
      }}
    >
      <FaMagic size={12} className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{parts.join(" · ")}</span>
      <button
        onClick={onAdd}
        className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
        }}
      >
        Add
      </button>
      <button
        onClick={onDismiss}
        className="p-0.5 rounded transition-colors hover:opacity-70"
        aria-label="Dismiss"
      >
        <FiX size={12} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/SuggestionBar.js
git commit -m "feat: add SuggestionBar component for inline AI task suggestions"
```

---

### Task 9: Create RecentFeed component

**Files:**
- Create: `components/inbox/RecentFeed.js`

- [ ] **Step 1: Create the component**

This renders a mixed list of tasks and notes, sorted by `updatedAt`. Tasks come from `useTasks`, notes are fetched separately.

```javascript
"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FiFileText, FiClock } from "react-icons/fi";
import TaskItem from "@/components/tasks/TaskItem";
import { extractPreview } from "@/lib/notes/preview";

export default function RecentFeed({
  tasks,
  onToggleComplete,
  onDelete,
  onEdit,
}) {
  const t = useTranslations("inbox");
  const tNotes = useTranslations("notes");
  const router = useRouter();
  const [notes, setNotes] = useState([]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setNotes(data.data.slice(0, 5));
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const feed = useMemo(() => {
    const taskItems = tasks.map((t) => ({
      id: t._id || t.id,
      type: "task",
      data: t,
      updatedAt: new Date(t.updatedAt || t.createdAt),
    }));
    const noteItems = notes.map((n) => ({
      id: n.id,
      type: "note",
      data: n,
      updatedAt: new Date(n.updatedAt),
    }));
    return [...taskItems, ...noteItems].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }, [tasks, notes]);

  if (feed.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="text-[11px] font-semibold mb-2 px-1"
        style={{ color: "var(--text-muted)" }}
      >
        {t("recentLabel")} <span className="font-normal">{feed.length}</span>
      </div>
      <div className="space-y-0.5">
        {feed.map((item) => {
          if (item.type === "task") {
            return (
              <TaskItem
                key={item.id}
                task={item.data}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            );
          }
          return (
            <button
              key={item.id}
              onClick={() => router.push(`/notes/${item.id}`)}
              className="w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-2.5"
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--surface-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <FiFileText
                size={14}
                className="mt-0.5 flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {item.data.title || tNotes("untitled")}
                </div>
                <div
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {extractPreview(item.data.content)}
                </div>
              </div>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--accent-light)",
                  color: "var(--accent)",
                }}
              >
                NOTE
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/RecentFeed.js
git commit -m "feat: add RecentFeed component for mixed tasks + notes in Inbox"
```

---

### Task 10: Rewrite Inbox page

**Files:**
- Modify: `app/[locale]/(app)/inbox/page.js`

- [ ] **Step 1: Rewrite the page**

Replace the current inbox page (DnD task list) with the capture-first design. Keep AI modal (Cmd+J) and task completion/deletion.

```javascript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTasks } from "@/hooks/useTasks";
import CaptureInput from "@/components/inbox/CaptureInput";
import RecentFeed from "@/components/inbox/RecentFeed";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("inbox");
  const queryClient = useQueryClient();

  const { tasks, loading, toggleComplete, deleteTask, quickAdd, refetch } =
    useTasks();

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Cmd+J → AI modal
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsAIModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for open-ai-modal from GlobalSearch
  useEffect(() => {
    const handler = () => setIsAIModalOpen(true);
    window.addEventListener("open-ai-modal", handler);
    return () => window.removeEventListener("open-ai-modal", handler);
  }, []);

  const handleTaskDetected = useCallback(
    async (parsed) => {
      try {
        await quickAdd({
          title: parsed.title,
          tags: parsed.tags || [],
          priority: parsed.priority || "medium",
          dateTime: parsed.dateTime || null,
        });
      } catch {
        toast.error(t("addFailed"));
      }
    },
    [quickAdd, t]
  );

  const fetchTasks = useCallback(
    ({ silent } = {}) => {
      if (!silent) return;
      refetch();
    },
    [refetch]
  );

  if (status === "loading" || loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
        <div className="h-8 w-32 rounded animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        <div className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {t("title")}
      </h1>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        {t("subtitle")}
      </p>

      <CaptureInput onTaskAdded={handleTaskDetected} />

      <RecentFeed
        tasks={tasks}
        onToggleComplete={toggleComplete}
        onDelete={deleteTask}
        onEdit={(id) => setSelectedTaskId(id)}
      />

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
        />
      )}

      <AIReminderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        fetchTasks={fetchTasks}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run dev and test**

Run: `npm run dev`

Navigate to `/inbox`:
- Capture input visible at top with placeholder
- Type text → debounce → AI suggestion appears if task detected
- Click Add → task created, input clears
- Recent feed shows tasks + notes mixed
- Cmd+J opens AI modal
- Task items work: complete, delete, edit
- Note items link to `/notes/{id}`

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/inbox/page.js
git commit -m "feat: rewrite Inbox as capture-first surface with AI suggestions"
```

---

### Task 11: Update translation files

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh-TW.json`

- [ ] **Step 1: Add new translation keys to en.json**

Add these keys to the existing namespaces:

In `"inbox"` section, add:
```json
"recentLabel": "Recent",
"parsing": "AI parsing...",
"addFailed": "Failed to add task"
```

In `"nav"` section, add:
```json
"workspace": "Workspace"
```

The `"parsing"` key already exists in `"quickAdd"` namespace. The `CaptureInput` uses `"inbox"` namespace, so add it there too.

- [ ] **Step 2: Add matching keys to zh-TW.json**

In `"inbox"` section, add:
```json
"recentLabel": "最近",
"parsing": "AI 解析中...",
"addFailed": "新增失敗"
```

In `"nav"` section, add:
```json
"workspace": "工作區"
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh-TW.json
git commit -m "feat: add translation keys for navigation redesign"
```

---

### Task 12: Integration smoke test

**Files:** None (manual verification)

- [ ] **Step 1: Test mobile flow (375px viewport)**

1. Open app on `/inbox` — capture input visible, 4 tabs at bottom
2. Type "meeting tomorrow at 3pm" — suggestion appears after debounce
3. Click Add — task created, appears in feed
4. Tap Today tab — dashboard loads with existing functionality
5. Tap Calendar tab — calendar loads
6. Tap Notes tab — notes list shows with previews
7. Tap a note — editor opens
8. Back to notes — list still there
9. Cmd+J — AI modal opens from any page

- [ ] **Step 2: Test desktop flow (1024px viewport)**

1. Sidebar visible on left with all items
2. No bottom nav visible
3. Navbar has no nav links (only utility buttons)
4. Click Inbox in sidebar — active indicator shows
5. Inbox capture input works
6. Click Notes — notes list view
7. Click All Tasks — existing reminders page loads
8. Sidebar active state updates on navigation

- [ ] **Step 3: Test responsive breakpoint (resize from 800 to 700px)**

1. Sidebar disappears at exactly 768px
2. Bottom nav appears at exactly 767px
3. No layout jump or content shift

- [ ] **Step 4: Run existing tests**

Run: `npm run test`
Expected: All existing tests pass. No regressions from navigation changes.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: No lint errors.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-05-navigation-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?