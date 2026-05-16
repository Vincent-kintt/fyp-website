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

// ---- tests -----------------------------------------------------------------

test.describe("Task drag-and-drop", () => {
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

      const handleBox = await getHandleBox(page, taskRow);
      const tomorrowBox = await tomorrowSection.boundingBox();

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

      // Scroll Completed section into view so the drag target is reachable
      await completedSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);

      const handleBox = await getHandleBox(page, taskRow);
      const completedBox = await completedSection.boundingBox();

      if (!handleBox || !completedBox) {
        test.skip("Cannot obtain bounding boxes");
        return;
      }

      // Use 0.7 fraction to land in the lower portion of the Completed section,
      // avoiding the Snoozed section just above it
      await dragToTarget(page, handleBox, completedBox, 0.7);

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
