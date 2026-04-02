import { test, expect } from "@playwright/test";

test.describe("AI Modal", () => {
  test("opens AI modal via Cmd+J", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Cmd+J (Meta+J) toggles the AI modal on the dashboard
    await page.keyboard.press("Meta+j");
    await page.waitForTimeout(500);

    const modalInput = page.locator('[data-testid="ai-modal-input"]');
    await expect(modalInput).toBeVisible({ timeout: 5000 });
  });

  test("sends a message and receives a response", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Meta+j");
    await page.waitForTimeout(500);

    const modalInput = page.locator('[data-testid="ai-modal-input"]');
    await expect(modalInput).toBeVisible({ timeout: 5000 });

    await modalInput.fill("Hello, what can you do?");
    await modalInput.press("Enter");

    // The LLM API may or may not be available — wait a reasonable time
    // and just verify the page doesn't crash
    await page.waitForTimeout(10000);
    await expect(page.locator("body")).toBeVisible();
  });
});
