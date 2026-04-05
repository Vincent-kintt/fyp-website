# UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Apple/Linear-style visual polish to the reminder app — checkbox fix, row hover, stagger refinement, page enter animations, spacing tokens, and button press feedback.

**Architecture:** CSS-only changes, no new dependencies. Modifications to `globals.css` for tokens/animations, `TaskItem.js` for checkbox + hover, `Button.js` for press feedback, and page components for stagger classes + spacing. All animations are opacity-only to avoid dnd-kit transform conflicts.

**Tech Stack:** Next.js 15, Tailwind CSS 4 (`@theme inline`), CSS custom properties, dnd-kit

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/globals.css` | Add `--checkbox-border`, `--spacing-*` tokens, `.page-enter-*` classes, update `.task-stagger-enter`, extend reduced-motion rule |
| Modify | `components/tasks/TaskItem.js` | Checkbox circle fix (touch target vs visual), row hover tint |
| Modify | `components/ui/Button.js` | Add `transition-transform` + `active:scale-[0.97]` |
| Modify | `components/ui/DragHandle.js` | Add `group-focus-within:opacity-100` |
| Modify | `components/tasks/TaskSection.js` | Update stagger delay values (40→30ms, cap 10) |
| Modify | `app/[locale]/(app)/dashboard/page.js` | Add `page-enter-*` classNames to sections |
| Modify | `components/dashboard/StatsOverview.js` | Replace `mb-8` with spacing token |

---

### Task 1: Add CSS tokens and animation classes to globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add `--checkbox-border` token to `:root` and `.dark`**

In `app/globals.css`, after the existing `--accent-light` line in `:root` (around line 68), add:

```css
    /* Checkbox */
    --checkbox-border: #636366;
```

In the `.dark` block (around line 195, after `--accent-light`), add:

```css
    /* Checkbox */
    --checkbox-border: #98989d;
```

- [ ] **Step 2: Add spacing tokens to `:root` with responsive overrides**

After the `.dark` block closing brace (around line 270), before the `@theme inline` block, add:

```css
  /* ── Spacing Tokens ── */
  :root {
    --spacing-page-x: 16px;
    --spacing-page-y: 24px;
    --spacing-section: 24px;
    --spacing-card: 16px;
    --spacing-row: 12px;
    --spacing-inline: 8px;
  }
  @media (min-width: 640px) {
    :root {
      --spacing-page-x: 24px;
      --spacing-page-y: 32px;
      --spacing-row: 8px;
    }
  }
```

- [ ] **Step 3: Update `.task-stagger-enter` timing**

In `app/globals.css` line 568, change:

```css
/* Before */
.task-stagger-enter {
  animation: fadeIn var(--duration-normal) var(--ease-decelerate) both;
}

/* After */
.task-stagger-enter {
  animation: fadeIn var(--duration-slow) var(--ease-decelerate) both;
}
```

- [ ] **Step 4: Add `.page-enter-*` classes**

After the `.task-stagger-enter` block (line 570), add:

```css
/* Page section stagger — opacity only for SSR safety */
.page-enter-1 { animation: fadeIn var(--duration-slow) var(--ease-decelerate) both; animation-delay: 0ms; }
.page-enter-2 { animation: fadeIn var(--duration-slow) var(--ease-decelerate) both; animation-delay: 80ms; }
.page-enter-3 { animation: fadeIn var(--duration-slow) var(--ease-decelerate) both; animation-delay: 140ms; }
.page-enter-4 { animation: fadeIn var(--duration-slow) var(--ease-decelerate) both; animation-delay: 200ms; }
.page-enter-5 { animation: fadeIn var(--duration-slow) var(--ease-decelerate) both; animation-delay: 260ms; }
```

- [ ] **Step 5: Extend reduced-motion rule to zero animation-delay**

In `app/globals.css` line 533, the existing reduced-motion block. Add after the existing `*::after` rule but inside the media query:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .page-enter-1, .page-enter-2, .page-enter-3,
  .page-enter-4, .page-enter-5,
  .task-stagger-enter {
    animation-delay: 0ms !important;
  }
}
```

- [ ] **Step 6: Verify dev server shows no errors**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "feat: add UX polish tokens, page-enter classes, update stagger timing"
```

---

### Task 2: Fix TaskItem checkbox and row hover

**Files:**
- Modify: `components/tasks/TaskItem.js`

- [ ] **Step 1: Refactor checkbox — separate touch target from visual circle**

In `components/tasks/TaskItem.js`, replace the checkbox button (lines 140-172) with:

```jsx
          {/* Checkbox — 44px touch target, 20px visual circle */}
          <button
            onClick={handleToggle}
            aria-label={t(currentTask.completed ? "markIncomplete" : "markComplete")}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-colors duration-200"
          >
            {currentTask.completed ? (
              <span className="w-5 h-5 rounded-full bg-success border-[1.5px] border-success flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline
                    points="20 6 9 17 4 12"
                    strokeDasharray="24"
                    strokeDashoffset="0"
                    style={{
                      animation: "checkmark-draw 200ms var(--ease-decelerate)",
                    }}
                  />
                </svg>
              </span>
            ) : (
              <span
                className="w-5 h-5 rounded-full border-[1.5px] transition-colors duration-200 hover:border-primary"
                style={{
                  borderColor: "var(--checkbox-border)",
                }}
              />
            )}
          </button>
```

- [ ] **Step 2: Update row hover — background tint, no shadow**

In `components/tasks/TaskItem.js`, replace the outer div (lines 119-130) className and style:

```jsx
        <div
          ref={ref}
          data-testid={`task-item-${task.id}`}
          className={`group relative flex items-start gap-2 py-3 sm:py-2 px-4 rounded-xl transition-[background] duration-[var(--duration-fast)] ${
            currentTask.completed ? "opacity-60" : ""
          } ${isDragging ? "opacity-50" : ""} ${animationClass || ""}`}
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
            borderWidth: "1px",
            borderStyle: "solid",
            animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
            ...dragStyle,
          }}
          onMouseEnter={(e) => {
            if (!isDragging) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.028)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--card-bg)";
          }}
        >
```

Note: We use mouse events instead of CSS hover because the `backgroundColor` inline style from dnd-kit would override CSS hover. The dark mode variant (`rgba(255,255,255,0.04)`) can be handled by checking `document.documentElement.classList.contains('dark')` in the handler, but for this iteration the subtle tint works in both modes.

- [ ] **Step 3: Verify checkbox renders correctly**

Open `http://localhost:3000/en/dashboard` in the browser. Verify:
- Unchecked: small 20px circle, not the old 44px circle
- Hover over circle: border turns blue
- Click to complete: green circle with white checkmark, sized at 20px
- Row hover: subtle background tint appears

- [ ] **Step 4: Commit**

```bash
git add components/tasks/TaskItem.js
git commit -m "fix: separate checkbox touch target from visual circle, add row hover tint"
```

---

### Task 3: Update Button press feedback

**Files:**
- Modify: `components/ui/Button.js`

- [ ] **Step 1: Add transition-transform and active:scale to Button baseStyles**

In `components/ui/Button.js` line 16, replace:

```js
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
```

With:

```js
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-[colors,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
```

- [ ] **Step 2: Verify button press feedback**

Open `http://localhost:3000/en/dashboard`. Click any button that uses the `Button` component (e.g., Logout in navbar). Verify subtle scale-down on press.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.js
git commit -m "feat: add press feedback (scale 0.97) to Button component"
```

---

### Task 4: Fix DragHandle keyboard accessibility

**Files:**
- Modify: `components/ui/DragHandle.js`

- [ ] **Step 1: Add group-focus-within visibility to DragHandle**

In `components/ui/DragHandle.js`, line 14, in the className string, after `sm:group-hover:opacity-100`, add `sm:group-focus-within:opacity-100`:

```jsx
      className="touch-none cursor-grab active:cursor-grabbing rounded flex-shrink-0
                 p-1 -ml-1
                 sm:absolute sm:top-4 sm:-left-8 sm:w-6 sm:h-6 sm:m-0 sm:p-0
                 sm:flex sm:items-center sm:justify-center
                 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:transition-opacity sm:duration-200"
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/DragHandle.js
git commit -m "fix: add keyboard focus visibility to DragHandle"
```

---

### Task 5: Update TaskSection stagger delay values

**Files:**
- Modify: `components/tasks/TaskSection.js`

- [ ] **Step 1: Update delay calculation**

In `components/tasks/TaskSection.js` line 180, change:

```jsx
            animationDelay={Math.min(index * 40, 600)}
```

To:

```jsx
            animationDelay={Math.min(index * 30, 300)}
```

- [ ] **Step 2: Commit**

```bash
git add components/tasks/TaskSection.js
git commit -m "feat: refine stagger timing — 30ms interval, 300ms cap"
```

---

### Task 6: Apply page-enter stagger to dashboard

**Files:**
- Modify: `app/[locale]/(app)/dashboard/page.js`

- [ ] **Step 1: Add page-enter-1 to header section**

In `app/[locale]/(app)/dashboard/page.js` line 583, change:

```jsx
      <div className="mb-6">
```

To:

```jsx
      <div className="mb-6 page-enter-1">
```

- [ ] **Step 2: Add page-enter-2 to StatsOverview wrapper**

The `StatsOverview` component is rendered at line 601. Wrap it:

```jsx
      <div className="page-enter-2">
        <StatsOverview tasks={overdueTasks.concat(todayTasks, completedToday)} />
      </div>
```

- [ ] **Step 3: Add page-enter-3 to NextTaskCard wrapper**

At line 604-611, change:

```jsx
      {nextTask && (
        <div className="mb-8 page-enter-3">
```

- [ ] **Step 4: Add page-enter-4 to QuickAdd wrapper**

At line 614, change:

```jsx
      <div className="mb-8 page-enter-4">
```

- [ ] **Step 5: Add page-enter-5 to DndContext wrapper**

At line 622, wrap the DndContext in a div:

```jsx
      <div className="page-enter-5">
        <DndContext
          ...
        >
          ...
        </DndContext>
      </div>
```

- [ ] **Step 6: Verify page enter animation**

Open `http://localhost:3000/en/dashboard`. Reload the page. Verify sections fade in sequentially: header → stats → hero card → quick add → task sections.

- [ ] **Step 7: Commit**

```bash
git add app/\[locale\]/\(app\)/dashboard/page.js
git commit -m "feat: add page-enter stagger animation to dashboard"
```

---

### Task 7: Apply spacing tokens to dashboard

**Files:**
- Modify: `app/[locale]/(app)/dashboard/page.js`
- Modify: `components/dashboard/StatsOverview.js`

- [ ] **Step 1: Update StatsOverview margin**

In `components/dashboard/StatsOverview.js` line 14, change:

```jsx
    <div className="grid grid-cols-3 gap-4 mb-8">
```

To:

```jsx
    <div className="grid grid-cols-3 gap-4" style={{ marginBottom: "var(--spacing-section)" }}>
```

- [ ] **Step 2: Update dashboard section margins to use spacing tokens**

In `app/[locale]/(app)/dashboard/page.js`:

Line 583, the header wrapper:
```jsx
      <div className="page-enter-1" style={{ marginBottom: "var(--spacing-section)" }}>
```

Line 605 (NextTaskCard wrapper):
```jsx
        <div className="page-enter-3" style={{ marginBottom: "var(--spacing-section)" }}>
```

Line 614 (QuickAdd wrapper):
```jsx
      <div className="page-enter-4" style={{ marginBottom: "var(--spacing-section)" }}>
```

- [ ] **Step 3: Verify spacing consistency**

Open `http://localhost:3000/en/dashboard`. Verify consistent 24px gaps between all major sections (header, stats, hero card, quick add, task sections).

- [ ] **Step 4: Commit**

```bash
git add app/\[locale\]/\(app\)/dashboard/page.js components/dashboard/StatsOverview.js
git commit -m "feat: apply spacing tokens to dashboard page"
```

---

### Task 8: Visual verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: no new errors

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: all existing tests pass

- [ ] **Step 3: Visual check — light mode desktop**

Open `http://localhost:3000/en/dashboard` at 1280px viewport. Verify:
- Checkbox circles are 20px, not 44px
- Row hover shows subtle background tint
- Buttons have press feedback
- Page sections fade in sequentially
- Spacing is consistent between sections

- [ ] **Step 4: Visual check — light mode mobile**

Open `http://localhost:3000/en/dashboard` at 390px viewport. Verify:
- Checkbox touch target is still large enough to tap
- Row padding is 12px (vs 8px on desktop)
- Action buttons are always visible (not hover-gated)
- Bottom nav is not overlapping content

- [ ] **Step 5: Visual check — dark mode**

Toggle to dark mode. Verify:
- Checkbox border color is `#98989d` (visible on dark surface)
- Row hover tint is visible but subtle
- No contrast issues with text or icons

---

### Follow-up (not in this plan)

The spec calls for applying page-enter stagger and spacing tokens to reminders, calendar, and inbox pages. These follow the same pattern as Task 6 and 7 but adapted to each page's section structure. They should be separate commits after this plan is complete.
