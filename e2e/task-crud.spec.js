import { test, expect } from "@playwright/test";

/**
 * Helper: create a task via QuickAdd and wait for it to appear.
 */
async function createTask(page, title) {
  await page.click('[data-testid="quick-add-trigger"]');
  await page.fill('[data-testid="quick-add-input"]', title);
  await page.press('[data-testid="quick-add-input"]', "Enter");
  await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });
}

test.describe("Task CRUD", () => {
  test("creates a task via QuickAdd", async ({ page }) => {
    const taskTitle = `E2E Create ${Date.now()}`;
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await createTask(page, taskTitle);
  });

  test("edits a task title via side panel", async ({ page }) => {
    const taskTitle = `E2E Edit ${Date.now()}`;
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Create the task first
    await createTask(page, taskTitle);

    // Find the task item in the task list (has data-testid)
    const taskRow = page
      .locator('[data-testid^="task-item-"]')
      .filter({ hasText: taskTitle })
      .first();
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    // Hover to reveal action buttons, then click the edit (pencil) icon
    await taskRow.hover();
    // The edit button is the one with FaEdit svg — second-to-last among the icon buttons
    // Action buttons order: [snooze (moon)], [edit (pencil)], [delete (trash)]
    const actionButtons = taskRow.locator("button").filter({ has: page.locator("svg") });
    // Edit button is the second-to-last
    const editBtn = actionButtons.nth(-2);
    await editBtn.click();

    // Wait for side panel with title input
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    const newTitle = `${taskTitle} Edited`;
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // Save — look for Chinese "儲存" or English "Save"
    const saveButton = page.locator('button:has-text("Save"), button:has-text("儲存")');
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }

    // Verify the edited title appears (use .first() to avoid strict mode violation
    // since it may show in both the focus card and task list)
    await expect(page.locator(`text=${newTitle}`).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("completes a task via checkbox", async ({ page }) => {
    const taskTitle = `E2E Complete ${Date.now()}`;
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Create the task first
    await createTask(page, taskTitle);

    // Find the task row in the task list
    const taskRow = page
      .locator('[data-testid^="task-item-"]')
      .filter({ hasText: taskTitle })
      .first();
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    // The checkbox is the round button (w-6 h-6 rounded-full border-2)
    const checkbox = taskRow.locator("button.rounded-full");
    await checkbox.click();

    // After clicking, the task should get a "line-through" style on its title
    await page.waitForTimeout(500);
    const title = taskRow.locator("h3");
    await expect(title).toHaveClass(/line-through/, { timeout: 5000 });
  });

  test("deletes a task with undo toast", async ({ page }) => {
    const taskTitle = `E2E Delete ${Date.now()}`;
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Create the task first
    await createTask(page, taskTitle);

    // Find the task row
    const taskRow = page
      .locator('[data-testid^="task-item-"]')
      .filter({ hasText: taskTitle })
      .first();
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    // Hover to reveal action buttons, then click delete (FaTrash)
    await taskRow.hover();
    // Delete button is the last action button with an svg icon
    const deleteBtn = taskRow
      .locator("button")
      .filter({ has: page.locator("svg") })
      .last();
    await deleteBtn.click();

    // Undo toast shows "已刪除" with "撤銷" action
    const toast = page.locator("text=已刪除");
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Wait for the deferred delete to complete (5s window)
    await page.waitForTimeout(6000);
  });
});
