/**
 * Regression net for dashboard drag-and-drop behavior (C5 PR1/7).
 * Uses real pointer events — dnd-kit PointerSensor has activationConstraint.distance: 8.
 *
 * Sections use data-testid="task-section-{sectionId}", e.g.:
 *   "task-section-section-today", "task-section-section-tomorrow", "task-section-section-completed"
 *
 * Task rows use data-testid="task-item-{id}".
 * Drag handle: button[aria-label="Drag to reorder"] inside each task row.
 *
 * Tasks are created via API (page.request.post) to avoid QuickAdd timing issues.
 * Cleanup also via API DELETE.
 */

import { test, expect } from "@playwright/test";

// ---- helpers ---------------------------------------------------------------

/**
 * Return an ISO string for today at the given hour:minute (local midnight + offset).
 * Uses current date so tests run in the real "today" section.
 */
function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Return an ISO string for tomorrow at the given hour:minute.
 */
function tomorrowAt(hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Create a task via POST /api/reminders and return the created task id.
 * Uses page.request so auth cookies are automatically included.
 */
async function createTaskApi(page, title, dateTime) {
  const res = await page.request.post("/api/reminders", {
    data: { title, dateTime },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return body.data?.id ?? body.id;
}

/**
 * Delete a task via DELETE /api/reminders/:id (permanent, no undo window).
 */
async function deleteTaskApi(page, taskId) {
  if (!taskId) return;
  await page.request.delete(`/api/reminders/${taskId}`).catch(() => {});
}

/**
 * Perform a pointer drag from `handleBox` centre to `targetBox` centre.
 * Uses >8 px initial move to clear dnd-kit activationConstraint.distance: 8.
 */
async function dragToTarget(page, handleBox, targetBox, targetYFraction = 0.5) {
  const fromX = handleBox.x + handleBox.width / 2;
  const fromY = handleBox.y + handleBox.height / 2;
  const toX = targetBox.x + targetBox.width / 2;
  const toY = targetBox.y + targetBox.height * targetYFraction;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.waitForTimeout(100); // let dnd-kit register pointerdown
  // First move: >8 px horizontally to clear activation constraint
  await page.mouse.move(fromX + 50, fromY, { steps: 5 });
  // Then move to target
  await page.mouse.move(toX, toY, { steps: 15 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(400); // let optimistic UI and React Query settle
}

/**
 * Get the drag handle bounding box for a task row.
 * Hovers the row first to ensure the handle is visible (SM: opacity-0 until hover).
 */
async function getHandleBox(page, taskRow) {
  await taskRow.hover();
  const handle = taskRow.locator('[aria-label="Drag to reorder"]');
  await expect(handle).toBeVisible({ timeout: 3000 });
  return handle.boundingBox();
}

// ---- setup / teardown ------------------------------------------------------

// Cleanup leftover test artifacts from prior runs to ensure deterministic state.
// Runs before every test so a crashed run never pollutes the next.
const TEST_TITLE_PATTERNS = [/^DnD-/, /^E2E /];

async function cleanupTestTasks(page) {
  try {
    const res = await page.request.get("/api/reminders");
    if (!res.ok()) return;
    const body = await res.json();
    const items = body.data;
    if (!Array.isArray(items)) return;
    const targets = items.filter(
      (t) => t?.title && TEST_TITLE_PATTERNS.some((re) => re.test(t.title)),
    );
    await Promise.all(
      targets.map((t) =>
        page.request.delete(`/api/reminders/${t.id}`).catch(() => {}),
      ),
    );
  } catch {
    // best effort — never let cleanup crash the test
  }
}

// ---- tests -----------------------------------------------------------------

test.describe("Task drag-and-drop", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestTasks(page);
  });
  /**
   * Scenario A: Within-section reorder (Today -> Today)
   * Create 2 today tasks with explicit sort orders, drag first below second,
   * assert order swapped.
   */
  test("A: within-section reorder — first task moves below second", async ({ page }) => {
    const ts = Date.now();
    const titleA = `DnD-A-alpha-${ts}`;
    const titleB = `DnD-A-beta-${ts}`;

    // Create via API — both at same time today (9 AM), different titles
    const idA = await createTaskApi(page, titleA, todayAt(9, 0));
    const idB = await createTaskApi(page, titleB, todayAt(9, 30));

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const todaySection = page.locator(
        '[data-testid="task-section-section-today"]',
      );
      await expect(todaySection).toBeVisible({ timeout: 5000 });

      const rowA = todaySection
        .locator('[data-testid^="task-item-"]')
        .filter({ hasText: titleA })
        .first();
      const rowB = todaySection
        .locator('[data-testid^="task-item-"]')
        .filter({ hasText: titleB })
        .first();

      await expect(rowA).toBeVisible({ timeout: 8000 });
      await expect(rowB).toBeVisible({ timeout: 8000 });

      // Record pre-drag DOM order
      const allRows = todaySection.locator('[data-testid^="task-item-"]');
      const testRows = allRows.filter({ hasText: new RegExp(`DnD-A-.*-${ts}`) });
      const preDragIds = await testRows.evaluateAll((els) =>
        els.map((el) => el.dataset.testid),
      );

      // Drag A to the position of B (move A below B)
      const handleBox = await getHandleBox(page, rowA);
      const targetBox = await rowB.boundingBox();

      if (!handleBox || !targetBox) {
        test.skip("Cannot obtain bounding boxes");
        return;
      }

      await dragToTarget(page, handleBox, targetBox);

      // Re-query order — should have changed
      const postDragIds = await testRows.evaluateAll((els) =>
        els.map((el) => el.dataset.testid),
      );

      expect(postDragIds).not.toEqual(preDragIds);
    } finally {
      await deleteTaskApi(page, idA);
      await deleteTaskApi(page, idB);
    }
  });

  /**
   * Scenario B: Cross-section date move (Today -> Tomorrow)
   * Create a today task via API, drag it onto the Tomorrow section,
   * assert it now appears under the Tomorrow section header.
   */
  test("B: cross-section date move — today task dragged to tomorrow section", async ({ page }) => {
    const ts = Date.now();
    const title = `DnD-B-today-${ts}`;

    const taskId = await createTaskApi(page, title, todayAt(10, 0));

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const todaySection = page.locator(
        '[data-testid="task-section-section-today"]',
      );
      await expect(todaySection).toBeVisible({ timeout: 5000 });

      const taskRow = todaySection
        .locator('[data-testid^="task-item-"]')
        .filter({ hasText: title })
        .first();
      await expect(taskRow).toBeVisible({ timeout: 8000 });

      const tomorrowSection = page.locator(
        '[data-testid="task-section-section-tomorrow"]',
      );
      await expect(tomorrowSection).toBeVisible({ timeout: 5000 });

      // Scroll tomorrow section into view so the drag target is reachable
      await tomorrowSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);

      // If Tomorrow is collapsed (defaultCollapsed=true when todayTasks.length > 3),
      // click its header button to expand it so the inner droppable is rendered.
      const tomorrowHeader = tomorrowSection.locator("button").first();
      const tomorrowDropZoneCheck = tomorrowSection.locator('[aria-live="polite"]').first();
      const isCollapsed = await tomorrowDropZoneCheck.isVisible().then((v) => !v);
      if (isCollapsed) {
        await tomorrowHeader.click();
        await page.waitForTimeout(200);
      }

      const handleBox = await getHandleBox(page, taskRow);

      // Grab the INNER droppable (TaskListContent div with aria-live="polite"),
      // not the outer data-testid wrapper. The actual dnd-kit drop zone is on
      // the inner element (TaskSection.js:155-166).
      const tomorrowDropZone = tomorrowSection.locator('[aria-live="polite"]').first();
      await expect(tomorrowDropZone).toBeVisible({ timeout: 5000 });
      const tomorrowBox = await tomorrowDropZone.boundingBox();

      if (!handleBox || !tomorrowBox) {
        test.skip("Cannot obtain bounding boxes");
        return;
      }

      await dragToTarget(page, handleBox, tomorrowBox);

      // Task should now appear in tomorrow section
      await expect(
        tomorrowSection
          .locator('[data-testid^="task-item-"]')
          .filter({ hasText: title })
          .first(),
      ).toBeVisible({ timeout: 10000 });

      // And should no longer be in today section
      await expect(
        todaySection
          .locator('[data-testid^="task-item-"]')
          .filter({ hasText: title }),
      ).toHaveCount(0, { timeout: 5000 });
    } finally {
      await deleteTaskApi(page, taskId);
    }
  });

  /**
   * Scenario C: Cross-section status move (Today -> Completed)
   * Create a today task via API, drag it onto the Completed Today section,
   * assert it appears there with line-through on its title.
   */
  test("C: cross-section status move — today task dragged to completed section", async ({ page }) => {
    const ts = Date.now();
    const title = `DnD-C-complete-${ts}`;

    const taskId = await createTaskApi(page, title, todayAt(11, 0));

    try {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const todaySection = page.locator(
        '[data-testid="task-section-section-today"]',
      );
      await expect(todaySection).toBeVisible({ timeout: 5000 });

      const taskRow = todaySection
        .locator('[data-testid^="task-item-"]')
        .filter({ hasText: title })
        .first();
      await expect(taskRow).toBeVisible({ timeout: 8000 });

      const completedSection = page.locator(
        '[data-testid="task-section-section-completed"]',
      );
      await expect(completedSection).toBeVisible({ timeout: 5000 });

      // Grab the INNER droppable (aria-live="polite"), same pattern as Scenario B.
      // Completed section defaults to expanded (defaultCollapsed={false}), but be
      // defensive in case it's collapsed from prior state.
      let completedDropZone = completedSection.locator('[aria-live="polite"]').first();
      if ((await completedDropZone.count()) === 0) {
        await completedSection.locator("button").first().click();
        await page.waitForTimeout(200);
        completedDropZone = completedSection.locator('[aria-live="polite"]').first();
      }
      await expect(completedDropZone).toBeVisible({ timeout: 5000 });

      // Hover the task row so the opacity-0 handle becomes visible.
      await taskRow.hover();
      const handle = taskRow.locator('[aria-label="Drag to reorder"]');
      await expect(handle).toBeVisible({ timeout: 3000 });

      // Get the task row's data-testid so we can locate it precisely in evaluate.
      const taskTestId = await taskRow.getAttribute("data-testid");

      // Compute page-absolute positions of handle and completed drop zone using
      // getBoundingClientRect + scrollY so we don't trigger any Playwright scroll.
      const positions = await page.evaluate(
        ([taskId, completedSel]) => {
          const taskEl = document.querySelector(`[data-testid="${taskId}"]`);
          const completedEl = document.querySelector(completedSel);
          if (!taskEl || !completedEl) return null;
          const handleEl = taskEl.querySelector('[aria-label="Drag to reorder"]');
          if (!handleEl) return null;
          const handleRect = handleEl.getBoundingClientRect();
          const completedRect = completedEl.getBoundingClientRect();
          const scrollY = window.scrollY;
          return {
            handlePageY: handleRect.top + scrollY,
            handlePageX: handleRect.left + window.scrollX,
            handleWidth: handleRect.width,
            handleHeight: handleRect.height,
            completedPageY: completedRect.top + scrollY,
            completedPageX: completedRect.left + window.scrollX,
            completedWidth: completedRect.width,
            completedHeight: completedRect.height,
          };
        },
        [taskTestId, '[data-testid="task-section-section-completed"] [aria-live="polite"]'],
      );

      if (!positions) {
        test.skip("Cannot locate elements for bbox calculation");
        return;
      }

      // Scroll so that the Completed drop zone bottom aligns near viewport bottom.
      // The handle (in Today section) is above the Completed section in DOM order,
      // so scrolling to show Completed should also keep the handle in view —
      // unless Overdue is very long. In that case we accept the handle may be near top.
      const viewportH = 720;
      // scrollForCompleted: scroll so completed bottom is ~20px above viewport bottom
      const scrollForCompleted = Math.max(
        0,
        positions.completedPageY + positions.completedHeight - viewportH + 20,
      );
      await page.evaluate((sy) => window.scrollTo(0, sy), scrollForCompleted);
      await page.waitForTimeout(150);

      // Read viewport-relative bboxes. If handle is above viewport (e.g. many
      // Overdue tasks push Today section above the scroll target), nudge scroll up.
      let handleBox = await handle.boundingBox();
      let completedBox = await completedDropZone.boundingBox();

      if (handleBox && handleBox.y < 20) {
        // Handle is too close to/above viewport top — scroll up a bit.
        const adjust = 20 - handleBox.y;
        await page.evaluate((dy) => window.scrollBy(0, -dy), adjust);
        await page.waitForTimeout(100);
        handleBox = await handle.boundingBox();
        completedBox = await completedDropZone.boundingBox();
      }

      if (!handleBox || !completedBox) {
        test.skip("Cannot obtain bounding boxes after scroll");
        return;
      }

      // Both boxes are in viewport. Drag to center of the actual drop zone.
      await dragToTarget(page, handleBox, completedBox);

      // Task should appear in completed section
      const completedRow = completedSection
        .locator('[data-testid^="task-item-"]')
        .filter({ hasText: title });
      await expect(completedRow.first()).toBeVisible({ timeout: 12000 });

      // Title should have line-through styling
      const titleEl = completedRow.first().locator("h3");
      await expect(titleEl).toHaveClass(/line-through/, { timeout: 5000 });
    } finally {
      await deleteTaskApi(page, taskId);
    }
  });
});
