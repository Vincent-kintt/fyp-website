import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(import.meta.dirname, "../.playwright-auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");

  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');

  await page.waitForURL("/dashboard", { timeout: 15000 });

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name.includes("authjs.session-token"));
  expect(sessionCookie).toBeTruthy();

  await page.context().storageState({ path: authFile });
});
