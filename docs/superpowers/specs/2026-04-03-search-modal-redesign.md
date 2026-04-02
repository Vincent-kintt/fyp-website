# Search Modal Redesign — Dense Minimal

**Date:** 2026-04-03
**Style:** Linear-inspired dense minimal (flat, high-contrast, monochrome)
**Scope:** Visual-only redesign of `components/search/GlobalSearch.js` and cmdk styles in `app/globals.css`. No logic, routing, or behavioral changes.

## Design Direction

Linear-style command palette. Zero decoration. Status dots instead of icons. Monochrome palette with color reserved for status indicators and tags only. Keyboard hints in footer. Tight spacing, maximum information density.

## Color System

### Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| modal-bg | #0a0a0a | Modal background |
| modal-border | #1a1a1a | Modal border, section dividers |
| surface-hover | #111111 | Selected/hovered item background |
| divider | #141414 | Separator between sections |
| text-primary | #cccccc | Selected item title |
| text-secondary | #999999 | Default item title |
| text-muted | #555555 | Placeholder, search icon stroke |
| text-faint | #333333 | Group headers, kbd text, date |
| kbd-border | #222222 | Keyboard badge border |
| overlay-bg | rgba(0, 0, 0, 0.6) | Backdrop overlay |

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| modal-bg | #ffffff | Modal background |
| modal-border | #e5e5e5 | Modal border |
| surface-hover | #f7f7f7 | Selected/hovered item background |
| divider | #f0f0f0 | Separator between sections, input border-bottom |
| text-primary | #333333 | Selected item title |
| text-secondary | #555555 | Default item title |
| text-muted | #999999 | Placeholder, search icon stroke |
| text-faint | #aaaaaa | Group headers, kbd text |
| date-color | #bbbbbb | Date text |
| kbd-bg | #f5f5f5 | Keyboard badge background |
| kbd-border | #e5e5e5 | Keyboard badge border |
| overlay-bg | rgba(0, 0, 0, 0.3) | Backdrop overlay |
| shadow | 0 16px 48px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04) | Modal shadow (light mode only) |

### Status Dot Colors (both modes)

| Status | Color |
|--------|-------|
| pending | #f59e0b |
| in_progress | #3b82f6 |
| completed | #22c55e |
| snoozed | #a855f7 |

### Tag Styling (both modes)

Tags use their category color at very low opacity for background, full color for text:
- Dark: `{color}18` background, `{color}` text
- Light: `{color}15` background, `{color}` text (slightly darker variant if needed for contrast)
- Only show first tag per item (reduce clutter)
- Font: 10px, font-weight 500, border-radius 4px, padding 1px 6px

## Typography

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Search input | 13px | 400 | Placeholder color: text-muted |
| Item title | 13px | 500 | text-secondary default, text-primary when selected |
| Item date | 10px | 400 | text-faint (dark) / date-color (light) |
| Group heading | 10px | 600 | uppercase, letter-spacing: 0.8px, text-faint |
| Kbd badge | 9px | 400 | monospace, text-faint |
| Tag | 10px | 500 | Category color |

## Layout Structure

```
┌─────────────────────────────────────┐
│ 🔍  Search reminders...       ⌘K   │  ← input area
├─────────────────────────────────────┤
│ ACTIONS                             │  ← group heading
│ [+] New Reminder                    │  ← quick action (selected)
│ [□] AI Assistant                    │  ← quick action
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤  ← 1px divider
│ IN PROGRESS                         │  ← group heading
│ ● Pay electricity bill     Mar 31   │  ← status dot + title + date
│ ● Reply to client email    Apr 1    │
│ ● Submit proposal          Apr 1    │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ COMPLETED                           │
│ ● Buy groceries                     │
├─────────────────────────────────────┤
│ ↑↓ navigate   ↵ open   esc close   │  ← footer
└─────────────────────────────────────┘
```

## Component Changes

### Input Area
- Search icon: 15px SVG stroke icon, stroke color text-muted
- Placeholder: 13px, text-muted
- Badge: show `⌘K` (trigger shortcut) instead of `ESC`. ESC moves to footer hints
- Padding: 12px 16px
- Border-bottom: 1px divider color

### Status Indicators
- Replace all react-icons (FaClock, FaPlay, FaCheck, FaPause) with 6px colored circles
- Color mapped by status (see Status Dot Colors table)
- Circle: width 6px, height 6px, border-radius 50%, flex-shrink 0

### Quick Action Icons
- Replace FaPlus with SVG: two perpendicular lines (13px, stroke text-muted, stroke-width 2)
- Replace FaRobot with SVG: rounded rectangle with inner detail (13px, stroke text-muted, stroke-width 2)
- Consistent 13px size, stroke style, 2px stroke-width

### Reminder Items
- Layout: dot + title (flex:1) + date (right-aligned) + tag (optional, max 1)
- Padding: 7px 10px
- Border-radius: 6px
- Tags shown below title only when search is empty (browsing mode). When searching, hide tags to keep results dense.

### Group Headers
- Font: 10px, weight 600, uppercase, letter-spacing 0.8px
- Color: text-faint
- Padding: 8px 10px 4px (top section), 6px 10px 4px (subsequent)
- No icons, no item counts

### Footer Bar
- Border-top: 1px divider color
- Padding: 8px 16px
- Content: `↑↓ navigate` · `↵ open` · `esc close`
- Each shortcut: kbd badge (9px monospace, border) + label (10px, text-faint)
- Gap between groups: 12px

### Section Dividers
- 1px line, color: divider
- Horizontal margin: 16px (not full-width, inset from edges)
- Between quick actions and reminder groups
- Between reminder status groups

## Hover & Selected States

- Selected item (keyboard navigation): background surface-hover, title color escalates to text-primary
- No border, no shadow, no scale transform
- Transition: background 100ms ease

## Overlay

- Dark mode: rgba(0, 0, 0, 0.6) with backdrop-filter: blur(4px)
- Light mode: rgba(0, 0, 0, 0.3) with backdrop-filter: blur(4px)

## Animations

| Action | Property | Duration | Easing |
|--------|----------|----------|--------|
| Modal open | opacity 0→1, translateY 8px→0 | 150ms | ease-out |
| Modal close | opacity 1→0 | 100ms | ease-in |
| Item hover/select | background-color | 100ms | ease |
| Loading skeleton | opacity pulse | 1.5s | ease-in-out infinite |

No scale, no spring, no blur transitions. Respect `prefers-reduced-motion`: disable translateY on open, keep opacity only.

## Loading State

Replace text-based loading indicator with 3 skeleton rows:
- Height: 32px per row
- Background: surface-hover with opacity pulse animation
- Border-radius: 6px
- Gap: 4px between rows

## Empty State (No Results)

- Text: "No results found" (use existing i18n key)
- Centered, 13px, text-muted
- Padding: 24px 0

## Keyboard Behavior (unchanged)

- `⌘K` / `Ctrl+K`: toggle open
- `↑↓`: navigate items
- `Enter`: select item (navigate to detail)
- `Escape`: close
- Typing: filter items (cmdk built-in)

## Limits

- Upcoming/in-progress items: max 6 (unchanged)
- Snoozed items: max 3 (unchanged)
- Completed items: max 4 (unchanged)
- Tags per item: max 1 (changed from 2)

## Files to Modify

1. `components/search/GlobalSearch.js` — Replace icons, restructure JSX, add footer, update class names
2. `app/globals.css` — Rewrite cmdk-* styles with new color tokens using CSS variables for theme support

## Out of Scope

- Search logic changes
- Adding new features (filters, inline actions, drag, pin)
- Routing behavior
- Cache / data fetching logic
- Mobile-specific layout (modal is already responsive via max-width + margin)
