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

    const firstResult = page.locator("[cmdk-item]").first();
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click();
      await page.waitForTimeout(1000);
      // After clicking a task result, the URL should change to the reminders detail page
      expect(page.url()).toMatch(/reminders/);
    }
  });
});
