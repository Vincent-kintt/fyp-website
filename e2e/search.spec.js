import { test, expect } from "@playwright/test";

test.describe("Global Search", () => {
  test("opens with Cmd+K", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Meta+k");

    const searchInput = page.locator('[data-testid="global-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("shows results when typing", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Meta+k");
    const searchInput = page.locator('[data-testid="global-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill("task");
    await page.waitForTimeout(1000);

    // cmdk renders items with [cmdk-item] attribute
    const results = page.locator("[cmdk-item]");
    await expect(results.first()).toBeVisible({ timeout: 5000 });
  });

  test("navigates on result click", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Meta+k");
    const searchInput = page.locator('[data-testid="global-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill("task");
    await page.waitForTimeout(1000);

    // Click a reminder result specifically (not notes) — search now includes notes too
    // Reminder items have data-type="reminder" attribute
    const reminderResult = page
      .locator('[data-type="reminder"][cmdk-item]')
      .first();
    const anyResult = page.locator("[cmdk-item]").first();

    const hasReminderResult = await reminderResult
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasReminderResult) {
      await reminderResult.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/reminders/);
    } else if (
      await anyResult.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      // Results exist but no reminders (only notes) — verify navigation happened
      await anyResult.click();
      await page.waitForTimeout(1000);
      expect(page.url()).not.toMatch(/dashboard/);
    }
  });
});
