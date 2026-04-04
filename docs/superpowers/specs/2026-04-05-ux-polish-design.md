# UX Polish Design Spec

Visual polish for the reminder app. Apple/Linear minimal aesthetic. CSS-only, no new dependencies. Information structure stays the same — only UI changes.

## Scope

High-impact items only. Four sections, applied incrementally.

## Section 1: TaskItem Component Polish

### 1A. Checkbox Circle Fix

Current: `w-6 h-6 min-w-[44px] min-h-[44px]` — min values override visual size to 44px.

Fix: outer `<button>` stays 44px for touch target. Inner `<span>` is the 20px visual circle.

```
<button class="... w-11 h-11 flex items-center justify-center ...">
  <span class="w-5 h-5 rounded-full border-[1.5px] ..."></span>
</button>
```

- Touch target: 44px (WCAG 2.5.5 compliant)
- Visual circle: 20px (aligns with Apple Reminders)
- Border color: `#636366` (4.58:1 contrast ratio, passes WCAG 1.4.11 non-text contrast 3:1)
- Hover: border color transitions to `--primary` (blue)
- Focus: existing `:focus-visible` ring stays on the outer button
- Checked state: unchanged (green fill + checkmark SVG animation)

File: `components/tasks/TaskItem.js` lines 140-172

### 1B. Row Hover — Linear/Apple Style

No shadow lift, no elevation, no transform.

- Hover: background tint only (`rgba(0,0,0,0.028)` / dark: `rgba(255,255,255,0.04)`)
- Action buttons: fade in on hover (desktop), always visible (mobile) — existing pattern preserved
- Transition: `background 120ms var(--ease-standard)`
- No `transform` or `box-shadow` on task rows — dnd-kit manages inline transforms

Action button hover-reveal must also trigger on keyboard `:focus-within` for accessibility.

File: `components/tasks/TaskItem.js` lines 119-130

### 1C. Stagger Animation Refinement

Existing `task-stagger-enter` class already applies opacity-only fadeIn with index-based delay.

Changes:
- Duration: 200ms → 280ms (slower decel for Apple-like feel)
- Per-item delay: 40ms → 30ms (snappier cascade)
- Max cap: 15 items (600ms) → 10 items (300ms max delay)
- Animation: stays opacity-only (no translateY — dnd-kit safe)
- `prefers-reduced-motion`: existing handler in globals.css covers this

Files:
- `app/globals.css` line 568 (`.task-stagger-enter` class)
- `components/tasks/TaskSection.js` line 180 (delay calculation)

## Section 2: Page-Level Enter Animations

Each page's sections fade in with staggered delays on mount. Opacity-only — no translateY on above-the-fold content to avoid SSR hydration flash.

### Approach

Add CSS classes for section-level stagger. Applied via className in page components, not via ScrollReveal (which causes opacity-0 flash on SSR pages).

```css
.page-enter-1 { animation: fadeIn 400ms var(--ease-decelerate) both; animation-delay: 0ms; }
.page-enter-2 { animation: fadeIn 400ms var(--ease-decelerate) both; animation-delay: 80ms; }
.page-enter-3 { animation: fadeIn 400ms var(--ease-decelerate) both; animation-delay: 140ms; }
.page-enter-4 { animation: fadeIn 400ms var(--ease-decelerate) both; animation-delay: 200ms; }
.page-enter-5 { animation: fadeIn 400ms var(--ease-decelerate) both; animation-delay: 260ms; }
```

### Dashboard stagger order

1. Header (title + date) — 0ms
2. Stats cards row — 80ms
3. Quick add input — 140ms
4. Task sections — 200ms+

### Other pages

Same pattern, adapted to each page's section structure. Apply incrementally — dashboard first, then reminders, calendar, inbox.

### Constraints

- Uses existing `fadeIn` keyframe from globals.css
- Not applied to dynamically loaded content (task items have their own stagger)
- `prefers-reduced-motion`: covered by existing globals.css rule that sets `animation-duration: 0.01ms`

Files:
- `app/globals.css` (add `.page-enter-*` classes)
- `app/[locale]/(app)/dashboard/page.js` (add classNames to sections)

## Section 3: Spacing Consistency

Define spacing tokens via Tailwind 4 `@theme` namespace. Apply per-page incrementally, starting with dashboard.

### Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-page-x` | 16px mobile / 24px desktop | Page horizontal padding |
| `--spacing-page-y` | 24px mobile / 32px desktop | Page vertical padding |
| `--spacing-section` | 24px | Gap between page sections |
| `--spacing-card` | 16px | Internal card/panel padding |
| `--spacing-row` | 8px desktop / 12px mobile | Row vertical padding |
| `--spacing-inline` | 8px | Gap between inline elements |

### Rhythm

All spacing follows an 8px base grid: 4 / 8 / 12 / 16 / 24 / 32.

### Layout changes

Current app layout (`app/[locale]/(app)/layout.js`):
```
px-4 sm:px-6 lg:px-8 py-8
```

This stays as-is. Spacing tokens are applied within page content, not at the layout shell level. Each page standardizes its internal spacing to match the token system.

### Desktop row padding

Codex flagged 12px vertical row padding as generous for desktop (Linear ~8px, Notion ~4px). Use responsive values: `py-3 sm:py-2` (12px mobile, 8px desktop).

### Rollout

Dashboard first → reminders → calendar → inbox. One page per commit.

Files:
- `app/globals.css` (define tokens in `@theme` or `:root`)
- Individual page components (apply tokens)

## Section 4: Interaction Feedback

### Button Press

Add `transition-transform` to Button component `baseStyles`. Currently only has `transition-colors`.

```diff
- "... transition-colors duration-200 ..."
+ "... transition-[colors,transform] duration-200 ..."
```

Add `active:scale-[0.97]` to Button component base styles. This applies to all Button instances (primary, secondary, ghost, etc.).

Exception: do NOT add scale feedback to elements managed by dnd-kit (task rows, drag handles). These elements have inline transforms set by the drag library.

File: `components/ui/Button.js` line 16

### Focus Rings

Existing `:focus-visible` rule in globals.css:
```css
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

Verify this covers:
- All Button variants
- Checkbox buttons in TaskItem
- Action buttons (edit, delete, snooze)
- Modal close buttons
- Navigation links

No code changes expected — just verification.

### Checkbox Completion Animation

Existing checkmark-draw animation stays. Only change: checkbox border color deepened for WCAG compliance.

Add a semantic token `--checkbox-border` to `:root` and `.dark`:
- Light: `#636366` (4.58:1 contrast on white)
- Dark: `#98989d` (appropriate contrast on dark surface)

Replace hard-coded `var(--text-muted)` with `var(--checkbox-border)` in:
- `components/tasks/TaskItem.js` — main task checkbox (line 150-151)
- All other checkbox-like elements using `var(--text-muted)` for borders

### Hover-Reveal Accessibility

Action buttons currently use `sm:opacity-0 sm:group-hover:opacity-100`. Add `focus-within:opacity-100` to ensure keyboard-navigated actions are visible.

Current code already has this (`focus-within:opacity-100` on line 272). Verify it works correctly.

## What Is NOT In Scope

- Information architecture changes (what data is displayed per row)
- Route-level page transitions (no View Transitions API, no framer-motion)
- New dependencies
- Full-page redesign
- Dark mode fixes beyond semantic token usage
- Swipe gestures for mobile actions (deferred)
- Keyboard shortcuts / context menu (deferred)
- Non-drag alternative for reorder (deferred, WCAG 2.5.7)

## Technical Notes

- Tailwind CSS 4: uses `@theme` directive for custom tokens, not `tailwind.config.js`
- Existing easing vars: `--ease-standard`, `--ease-decelerate`, `--ease-accelerate`
- Existing duration vars: `--duration-fast` (150ms), `--duration-normal` (200ms), `--duration-slow` (300ms)
- `prefers-reduced-motion` already handled globally in `app/globals.css`
- Semantic color tokens (`--text-muted`, `--border`, etc.) already defined for light/dark
- App layout shell padding stays unchanged — spacing tokens are internal to pages

## Rollout Strategy

1. globals.css: add spacing tokens + `.page-enter-*` classes + update `.task-stagger-enter` timing
2. TaskItem: checkbox fix + row hover + border contrast
3. Button: add `transition-transform` + `active:scale-[0.97]`
4. Dashboard page: apply page enter stagger + spacing tokens
5. Remaining pages: reminders → calendar → inbox (one per commit)
