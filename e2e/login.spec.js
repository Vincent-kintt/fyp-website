import { test, expect } from "@playwright/test";

// This spec tests login flow — does NOT use storageState
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login flow", () => {
  test("redirects to dashboard on valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(en\/)?dashboard/, { timeout: 15000 });
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="username"]', "wrong");
    await page.fill('input[name="password"]', "wrong");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/login/);
    // ErrorState renders a div with class bg-danger-light containing the error message
    const error = page.locator(".bg-danger-light");
    await expect(error).toBeVisible({ timeout: 10000 });
  });

  test("redirects unauthenticated user from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/login/, { timeout: 10000 });
  });
});
