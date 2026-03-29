# Frontend Improvement Design Spec

**Date:** 2026-03-30
**Approach:** B — Foundation-first + selective visual polish (no bottom nav)
**Dependencies:** None (all CSS + Tailwind 4 + React patterns)

---

## Current State (Exploration Findings)

- **110 hardcoded colors** across 20 files bypassing the CSS variable theme system
- **Zero** Next.js error/loading boundaries (no error.js, not-found.js, loading.js)
- Touch-inaccessible action buttons (opacity-0 group-hover on mobile)
- **Spinner-only** loading on inbox + calendar pages (dashboard + reminders already have skeletons)
- **5 different** empty state patterns, **3 different** error state patterns
- CSS variable system is comprehensive (backgrounds, surfaces, borders, text, semantic, motion tokens)
- Button/Input/Card base components exist but lack size variants and accessibility attributes

---

## Phase 1: Foundation — Accessibility + Theme Consistency

### 1A. Global Accessibility

**Files:** `app/globals.css`, `app/layout.js`

Changes:
- Replace all `focus:ring` patterns with `focus-visible:ring` globally (mouse clicks no longer show focus ring, keyboard Tab does)
- Add `@media (prefers-reduced-motion: reduce)` rule in globals.css to set all `animation-duration` and `transition-duration` to near-instant
- Add visually-hidden skip-to-content link in layout.js targeting `id="main-content"` on the `<main>` element

### 1B. Hardcoded Color Purge

**Files:** ~20 files, 110 occurrences

Systematic replacement mapping:

| Hardcoded Pattern | CSS Variable Replacement |
|---|---|
| `text-gray-900 dark:text-white` | `text-text-primary` |
| `text-gray-600 dark:text-gray-300` | `text-text-secondary` |
| `text-gray-500 dark:text-gray-400` | `text-text-muted` |
| `bg-white dark:bg-gray-800` | `bg-surface` |
| `bg-gray-50 dark:bg-gray-900` | `bg-background-secondary` |
| `border-gray-200 dark:border-gray-700` | `border-border` |
| `text-blue-600 dark:text-blue-400` | `text-primary` |
| `border-blue-600 dark:border-blue-400` | `border-primary` |
| `text-red-600 dark:text-red-400` | `text-danger` |
| `bg-red-50 dark:bg-red-900/30` | `bg-danger-light` |

**Worst offenders by file:**
- `app/page.js` — 16 instances
- `components/tasks/QuickAdd.js` — 18+ instances
- `components/tasks/TaskItem.js` — 13 instances
- `app/calendar/page.js` — 9 instances
- `app/inbox/page.js` — 4 instances
- `app/login/page.js` — 2 instances

**Special handling:**
- `getCategoryColor()` duplicated in TaskItem.js, QuickAdd.js, StatsOverview.js — consolidate into `lib/utils.js` with CSS variable-based color mapping
- QuickAdd.js priority colors (red/yellow/green) — replace with `--danger`/`--warning`/`--success` CSS variables
- TaskItem.js line 158 hardcoded hex `#dc2626` — replace with `text-danger`

### 1C. Button Enhancement

**File:** `components/ui/Button.js`

Additions:
- `size` prop: `sm` (h-8 text-sm), `md` (h-10 text-base, default), `lg` (h-12 text-lg)
- `ghost` variant: transparent bg, subtle hover — replaces ~15 inline ghost button patterns across the app
- `focus-visible:ring-2 focus-visible:ring-offset-2` replacing `focus:ring`
- `loading` prop: sets disabled + shows spinner icon inside button

### 1D. Input Enhancement

**File:** `components/ui/Input.js`

Changes:
- `focus:ring` to `focus-visible:ring`
- Error state adds `aria-invalid="true"` and `aria-describedby` pointing to the error message element's id
- `size` prop matching Button (sm/md/lg)

---

## Phase 2: Error Handling + Loading States

### 2A. Next.js Error Boundaries

Three new files:

**`app/error.js`** — Global error boundary
- `"use client"` component (Next.js requirement)
- Friendly error message + "Try again" button calling `reset()`
- CSS variable styling, no hardcoded colors
- Does not expose error stack traces to users

**`app/not-found.js`** — 404 page
- Clean "Page not found" message + link back to home
- Consistent with app styling

**`app/loading.js`** — Root loading fallback
- Full-page skeleton shimmer (reuses existing skeleton pattern from dashboard)
- Acts as Suspense fallback for all page-level navigation

### 2B. Skeleton Loading Completion

**Current state:** Dashboard and Reminders already have skeleton loaders. Inbox and Calendar still use spinners.

**New file:** `components/ui/Skeleton.js`
- Reusable skeleton primitive component
- Props: `width`, `height`, `rounded`, `className`
- Uses existing pulse animation from globals.css

**Page-specific replacements:**
- **Inbox page:** Replace spinner with header + quick-add bar + task list skeleton
- **Calendar page:** Replace spinner with month grid skeleton + timeline skeleton
- Dashboard and Reminders existing skeletons remain unchanged; if they define skeleton markup inline, refactor to use the Skeleton component

### 2C. ARIA Live Regions

Add `aria-live="polite"` to dynamic content regions:
- Task completion toggle status changes
- Filter switch list updates
- Drag-drop position changes
- Agent response streaming area

Attribute-only changes, no visual impact.

---

## Phase 3: Mobile UX

### 3A. Touch-Accessible Actions

**File:** `components/tasks/TaskItem.js`

Current: `opacity-0 group-hover:opacity-100` — action buttons (edit/delete/snooze) invisible on touch devices.

Change to: `opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100`

Result: Always visible on mobile, hover-reveal on desktop.

### 3B. Touch Target Sizes (WCAG 2.5.8: 44px minimum)

| Element | Current | Target |
|---|---|---|
| TaskItem checkbox | `w-5 h-5` (20px) | `w-6 h-6` + `p-2` wrapper (40px+ touch area) |
| Action buttons (edit/delete/snooze) | `p-1.5` (~28px) | `p-2.5` (~40px) |
| Subtask toggle | Small | Increased padding for 44px touch area |
| QuickAdd submit button | Varies | Ensure 44px minimum |

Approach: Increase padding/hit area only, not visual element size, to avoid UI bloat.

---

## Phase 4: Empty + Error State Consistency

### 4A. Unified Empty State

**New file:** `components/ui/EmptyState.js`

Props:
- `icon` — SVG component (no emoji)
- `title` — Primary message (e.g., "No tasks for today")
- `description` — Optional secondary text
- `action` — Optional button (label + onClick)

Replaces 5 inconsistent empty state patterns in:
- Dashboard TaskSection custom emptyAction structure
- Inbox inline icon + text
- Reminders "No reminders found" plain text
- Calendar (if applicable)
- TaskSection three-tier fallback

All instances replaced with EmptyState component using CSS variables.

### 4B. Unified Error State

**New file:** `components/ui/ErrorState.js`

Props:
- `message` — Error message text
- `onRetry` — Optional retry callback

Replaces 3 inconsistent error patterns in:
- Login page `bg-red-50 dark:bg-red-900/30` hardcoded pattern
- EditReminderModal error display
- Other inline error styling

All unified with `bg-danger-light` + `text-danger` CSS variables.

---

## Phase 5: Micro-Interactions (CSS-only)

### 5A. Task Completion Animation

**Files:** `app/globals.css`, `components/tasks/TaskItem.js`

Two effects:
1. **Checkmark draw:** SVG checkmark using `stroke-dasharray` + `stroke-dashoffset` animation, drawing the check from nothing to complete. Duration: 200ms.
2. **Border pulse:** Task left border does a single success-color pulse (green flash then return to normal) via `@keyframes border-pulse`.

Both wrapped in `@media (prefers-reduced-motion: reduce)` — skips to final state when reduced motion is preferred.

### 5B. Staggered List Load

**Files:** `app/globals.css`, `components/tasks/TaskSection.js`

Animation: `@keyframes fade-in-up`
- From: `opacity: 0; transform: translateY(8px)`
- To: `opacity: 1; transform: translateY(0)`
- Duration: 250ms
- Stagger: `animation-delay: index * 40ms`
- Cap: Stagger up to index 15, all items after appear simultaneously

Implementation: TaskSection applies inline `style={{ animationDelay }}` per child, references `.animate-fade-in-up` class from globals.css.

Wrapped in `prefers-reduced-motion` guard.

### 5C. Modal/Panel Exit Transition

**File:** `components/reminders/EditReminderModal.js` (and/or TaskDetailPanel)

Current: Modal unmounts instantly on close.

Change:
1. On close, set `isClosing = true`
2. Trigger CSS animation: `fade-out` + `scale(0.97)`, 150ms duration
3. `onAnimationEnd` callback triggers actual unmount

Pure CSS + boolean state, no animation library needed.

---

## Phase 6: Landing + Login Polish

### 6A. Landing Page

**File:** `app/page.js`

Three layers:

**Theme fix:** All 16 hardcoded colors replaced with CSS variables (handled by Phase 1B, listed here for completeness).

**Visual hierarchy:**
- Hero section: subtle radial gradient background using `--primary` at low opacity
- Feature cards: `shadow-sm` default, `hover:shadow-md` + `hover:translateY(-2px)` lift effect, 250ms transition
- Feature icons: circular background using semantic light colors (`bg-primary-light`, `bg-success-light`, `bg-info-light`)

**Scroll-triggered fade-in:**
- Native Intersection Observer API (zero dependencies)
- Each section fades in on viewport entry, reusing `fade-in-up` keyframe from Phase 5B
- Observer config: `threshold: 0.1`, triggers once per element
- Implementation: `useEffect` + `useRef` in the page component (or small inline hook)

### 6B. Login Page

**File:** `app/login/page.js`

Changes:
- Error message hardcoded red replaced with ErrorState component (from Phase 4B)
- Background: subtle gradient matching landing page
- Submit button loading: use Button's `loading` prop (from Phase 1C) instead of text swap
- Card elevation: add `shadow-md` for visual separation from background

---

## New Files Summary

| File | Purpose |
|---|---|
| `app/error.js` | Global error boundary |
| `app/not-found.js` | Custom 404 page |
| `app/loading.js` | Root loading fallback |
| `components/ui/Skeleton.js` | Reusable skeleton loader primitive |
| `components/ui/EmptyState.js` | Unified empty state component |
| `components/ui/ErrorState.js` | Unified error state component |

**Total new files:** 6

## Critical Files Touched Across Multiple Phases

- `app/globals.css` — Phase 1A, 5A, 5B, 5C
- `components/tasks/TaskItem.js` — Phase 1B, 3A, 3B, 5A
- `app/page.js` — Phase 1B, 6A
- `components/ui/Button.js` — Phase 1C
- `components/ui/Input.js` — Phase 1D
- `lib/utils.js` — Phase 1B (getCategoryColor consolidation)

## Verification Protocol

After each phase:
1. `npm run build` — no build errors
2. Light/dark theme toggle on every modified page
3. Mobile viewport test (Chrome DevTools, 375px width)
4. Keyboard-only navigation (Tab through page, verify focus-visible rings)
5. `prefers-reduced-motion` emulation (Chrome DevTools > Rendering)

## Out of Scope (Deliberately Excluded)

- Bottom navigation bar (Approach B decision: polish existing > add new nav paradigm)
- Keyboard shortcuts guide modal
- User avatar in Navbar
- New dependencies
- Typography/spacing token system
- Shadow gradation tokens
