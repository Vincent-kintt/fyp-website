# Progress
*Last updated: 2026-04-02*

## Current Focus

No active task. Test coverage complete (193 tests). Next priorities: user registration (#5), Export UI (#2), API pagination (#4).

## Backlog

### Medium Priority — Feature Enhancements
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | DayTimeline editing + Month DnD | DONE | TaskDetailPanel in Calendar + month view day-to-day drag (@dnd-kit). All E2E pass. |
| 2 | Export UI | TODO | `exportReminders` tool exists in `lib/ai/tools.js` but no UI trigger. Quick win. |
| 3 | StatsOverview scope | TODO | Only shows today's stats, not global picture. Add week/month/all tabs. |
| 4 | API pagination | TODO | `GET /api/reminders` returns all results, no limit |

### Medium Priority — Pre-Launch
| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | User registration | TODO | Currently seed-only via `scripts/initUsers.js`. Need signup page + API route. |
| 6 | Email Notifications | TODO | Resend + React Email. Needs `email` field in users collection. Depends on #5 user schema. |

### Medium Priority — DnD Improvements
| # | Task | Status | Notes |
|---|------|--------|-------|
| 7 | Dashboard DnD: stabilize bidirectional drag | DONE | Full bidirectional DnD working. CollapsedDropZone fix for collapsed sections. createSectionAwareCollision (pointerWithin + scoped closestCenter). Guards: block TO Overdue, block COMPLETED↔SNOOZED direct. E2E validated: reorder ✅, Overdue→Today ✅, Today→Completed ✅. |
| 8 | Dashboard DnD: re-implement bidirectional drag | DONE | Merged into #7 — bidirectional logic is already in code (handleDragEnd supports TO/FROM COMPLETED/SNOOZED + Date↔Date). |
| 9 | Calendar DnD: Timeline time drag | TODO | Phase 2: Drag tasks between time slots in DayTimeline. Use @dnd-kit Snap modifier, 2h blocks. |
| 10 | Calendar DnD: Resize duration | TODO | Phase 3: Drag bottom edge to change duration. Needs `duration` field. Use pointer events, not @dnd-kit. |

### Low Priority — Ongoing
| # | Task | Status | Notes |
|---|------|--------|-------|
| 11 | More test coverage | DONE | 193 tests (177 Vitest + 16 Playwright E2E). API routes >80% coverage. Spec: `docs/superpowers/specs/2026-04-01-test-coverage-design.md`. |

### Housekeeping
| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | Update CLAUDE.md architecture section | DONE | Updated `lib/agents/` → `lib/ai/`, updated AI agent system description to reflect Vercel AI SDK migration |

## Completed

| Date | What | Key Files |
|------|------|-----------|
| 2026-04-02 | Test coverage: 193 tests across 4 layers. API route integration tests (63), unit tests (30), E2E Playwright (16), existing (84). Coverage: reminders routes >83%, lib/reminderUtils 100%, lib/format 100%. Shared helpers extracted. data-testid on 7 components. | 19 new files: `tests/helpers/`, `tests/unit/`, `tests/integration/`, `e2e/` |
| 2026-04-01 | DnD stabilization: CollapsedDropZone fix for cross-section drag through collapsed sections. getSectionLabel unified to English. CLAUDE.md architecture updated (lib/ai/, middleware matcher, DnD, state mgmt, API routes). progress.md synced with actual code state. | `TaskSection.js`, `lib/dnd.js`, `CLAUDE.md`, `.claude/progress.md` |
| 2026-04-01 | Landing page redesign: UX audit P1/P2 fixes + Editorial Minimal visual upgrade. Route group migration (marketing)/(app). Button href polymorphism. Footer restored. Cursor pointer fix. Lucide icons. DM Serif Display + Outfit fonts. | `app/(marketing)/page.js` (new), `app/(app)/layout.js` (new), `components/layout/Footer.js` (new), `components/ui/Button.js`, `app/layout.js`, `app/globals.css` |
| 2026-04-01 | Calendar DayTimeline editing + month-view DnD. TaskDetailPanel integrated (click title to edit, checkbox to toggle). @dnd-kit month-view drag-and-drop (drag task pills between days to reschedule, optimistic update + rollback). Added CALENDAR_DAY_PREFIX + parseDayDropId to lib/dnd.js. | `DayTimeline.js`, `calendar/page.js`, `lib/dnd.js` |
| 2026-03-26 | Side panel conversion: EditReminderModal → TaskDetailPanel. Extracted TaskEditForm shared form. Right slide-over panel on Dashboard/Inbox (480px, split-view). Modal preserved on Reminders page. Fixed TaskItem state sync bug. | `TaskEditForm.js` (new), `TaskDetailPanel.js` (new), `EditReminderModal.js`, `TaskItem.js`, `TaskSection.js`, `dashboard/page.js`, `inbox/page.js`, `globals.css` |
| 2026-03-26 | UX animation improvements: optimistic updates (toggle/delete/snooze), modal exit animation, skeleton screens, staggered list enter, section collapse, motion design tokens, transition-all cleanup, prefers-reduced-motion | `globals.css`, `dashboard/page.js`, `TaskItem.js`, `TaskSection.js`, `EditReminderModal.js`, `AIReminderModal.js`, `NextTaskCard.js`, `reminders/page.js` |
| 2026-03-25 | Dead code cleanup (#6, #7, #8): removed 5 dead components, orphaned edit route, 2 legacy AI routes, `lib/llm.js`, stale test comments | 9 files deleted, `tests/handlers.test.js`, `CLAUDE.md` updated |
| 2026-03-25 | Web Push Notifications: SW, VAPID, subscribe API, cron notify, NotificationBell UI, cleanup cron, indexes | `public/sw.js`, `lib/push.js`, `app/api/push/`, `app/api/cron/notify/`, `components/layout/NotificationBell.js`, `hooks/usePushNotification.js` |
| 2026-03-25 | Fix 4 high-priority bugs: login redirect, middleware protection, landing page copy, remark data loss | `app/login/page.js`, `middleware.js`, `auth.config.js`, `app/page.js`, `components/reminders/EditReminderModal.js` |
| 2026-03-25 | Status transition validation, query conflict fix, error handling, Vitest setup (100 tests) | `app/api/reminders/`, `lib/agents/tools/handlers.js`, `tests/` |
| 2026-03-24 | Snooze UI with smart presets, global search enhancement | `components/tasks/SnoozePopover.js`, `components/search/GlobalSearch.js` |
| 2026-03-23 | Merge description/remark fields, status validation, UI refactor with section labels | `components/reminders/EditReminderModal.js`, `lib/utils.js` |
| 2026-03-22 | Drag-and-drop task reordering with sortOrder, cross-section movement | `lib/dnd.js`, `app/api/reminders/reorder/` |
| 2026-03-21 | AI UI: reasoning shimmer, tool result cards, suggested actions, mobile responsive | `components/reminders/` |
| 2026-03-20 | User ID migration from username to userId (ObjectId) | `scripts/migrateUserIds.js`, API routes |

## Session Log

- **2026-04-02**: Test coverage implementation complete. 193 tests across 4 layers: API route integration (63 tests in 4 files), unit tests (30 tests in 3 files), E2E Playwright (16 tests in 6 files), existing (84 tests in 2 files). Shared MongoMemoryServer helpers extracted. Fixed vi.mock hoisting for Vitest 4. Fixed parseResponse body-already-read bug. data-testid added to 7 components. Playwright auth setup with storageState. Coverage: reminders route 91%, [id] route 84%, reorder 91%, cron/notify 90%, reminderUtils 100%, format 100%. 19 new files, 8 modified. All lint/build/vitest/E2E pass.
- **2026-04-01**: DnD stabilization + doc sync. Found collapsed sections had no droppable zone (TaskListContent not rendered when collapsed), blocking cross-section drag through them. Fix: added CollapsedDropZone component (8px min-height droppable for collapsed sections). Fixed getSectionLabel mixed zh/en → all English. Updated CLAUDE.md: `lib/agents/` → `lib/ai/`, AI system description updated to Vercel AI SDK. Synced progress.md with actual code state (bidirectional DnD was never reverted, code has full logic with guards). E2E tested: within-section reorder ✅, Overdue→Today ✅, Today→Completed ✅. Files: `TaskSection.js`, `lib/dnd.js`, `CLAUDE.md`.
- **2026-04-01**: Dashboard DnD reorder bug fix (earlier session). Root cause: commit `edecba9` moved droppable to parent TaskSection. Fix: reverted droppable inside TaskListContent, added createSectionAwareCollision (pointerWithin + scoped closestCenter). Guards: block TO Overdue, block COMPLETED↔SNOOZED direct.
- **2026-04-01**: Merged feat/calendar-editing-dnd → main. 16 files, +605 -390. Route groups (marketing)/(app) migration included.
- **2026-04-01**: Landing page redesign. UX audit P1/P2 fixes (cursor pointer, button/link semantics, footer, subtitle contrast). Editorial Minimal visual upgrade (DM Serif Display + Outfit, left-aligned hero, Lucide icons). Route group migration: (marketing)/ for landing, (app)/ for authenticated pages. 3 new files, 3 modified, 5 directories moved. All lint/build/E2E pass.
- **2026-04-01**: Calendar DayTimeline editing + month-view DnD. 3 files modified. TaskDetailPanel reused from Dashboard pattern. @dnd-kit DroppableDay cells + DraggableTaskPill. Optimistic update + rollback. All lint/build/vitest/E2E pass (6/6).
- **2026-03-26**: Side panel conversion. Extracted TaskEditForm from EditReminderModal (657→~90 lines). Created TaskDetailPanel (right slide-over, 480px, split-view, no backdrop). Integrated into Dashboard + Inbox. Modal preserved on Reminders page. Fixed TaskItem state sync bug. Added slideFromRight/slideToRight CSS animations. 2 new files, 6 modified. All lint/build/E2E pass.
- **2026-03-26**: UX animation improvements. 8 files modified. Optimistic updates for toggle/delete/snooze (350-800ms → <50ms). Modal exit animation. Skeleton loading screens. Staggered list animations. Section collapse transition. Motion design tokens (M3 easing/duration). Replaced transition-all with specific properties. prefers-reduced-motion support. All lint/build/E2E pass.
- **2026-03-25**: Fixed 4 high-priority bugs (login redirect, middleware protection, landing page copy, remark data loss). All E2E tests passed.
- **2026-03-25**: Project state review. Created progress tracking system in `.claude/progress.md`.
- **2026-03-25**: Web Push Notification planning complete. Researched web-push + email (Resend). Created implementation plan (7 steps). Set up cron-job.org (disabled). Added CRON_SECRET to .env.local. Next session: execute plan Steps 0-6.
- **2026-03-25**: Web Push Notifications implemented. 12 new files, 10 modified. All lint/build/E2E pass. SW registered, bell UI in navbar, cron notify works, atomic double-send prevention.
- **2026-03-25**: Dead code cleanup (#6, #7, #8). Removed 9 files: 5 dead components, orphaned edit route, 2 legacy AI routes, lib/llm.js. Updated stale test comments. All lint/build/test pass.
