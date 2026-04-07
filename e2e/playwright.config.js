import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "../playwright-report" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.js/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "../.playwright-auth/user.json"),
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: isCI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !isCI,
    timeout: 60000,
  },
  outputDir: "../.playwright-mcp/screenshots",
});
