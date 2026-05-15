/**
 * NoteEditor C4 PR1 regression-net spec.
 *
 * Characterization mode: all 9 scenarios must pass on current main.
 * PRs 2-7 will rerun this suite as a regression gate.
 *
 * R10 note: Playwright route.fulfill delivers body atomically (non-streaming).
 * Intermediate streaming UI states cannot be observed; assert final state only.
 *
 * Fixture note: SSE text-delta events require an "id" field to pass
 * uiMessageChunkSchema validation. Fixtures were updated accordingly.
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../tests/fixtures");

const AGENT_STREAM_BODY = fs.readFileSync(
  path.join(fixturesDir, "notes-agent-stream.txt"),
  "utf8",
);
const AGENTIC_STREAM_BODY = fs.readFileSync(
  path.join(fixturesDir, "notes-agentic-stream.txt"),
  "utf8",
);
const AGENTIC_WITH_REMINDER_BODY = fs.readFileSync(
  path.join(fixturesDir, "notes-agentic-stream-with-reminder.txt"),
  "utf8",
);
const RSS_STREAM_BODY = fs.readFileSync(
  path.join(fixturesDir, "notes-rss-stream.txt"),
  "utf8",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a note via POST /api/notes and return the note id.
 */
async function createNote(page, title) {
  const res = await page.request.post("/api/notes", {
    data: { title },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data.id;
}

/**
 * Navigate to a note page and wait for the BlockNote editor to be ready.
 * Waits for the notes sidebar to settle (ensuring useNotes() has fetched data).
 */
async function goToNote(page, noteId) {
  await page.goto(`/notes/${noteId}`);
  await page.waitForSelector(".bn-editor", { timeout: 20000 });
  // Wait for the notes list to load (sidebar renders note links when useNotes resolves)
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

/**
 * Click into the editor body and type text via keyboard.
 */
async function typeInEditor(page, text) {
  const editor = page.locator(".bn-editor").first();
  await editor.click();
  await page.keyboard.type(text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("NoteEditor regression-net (C4 PR1)", () => {

  // ---- Scenario 1: autosave + reload persistence -------------------------

  test("scenario 1: autosave + reload persistence", async ({ page }) => {
    const title = `Autosave Test ${Date.now()}`;
    const noteId = await createNote(page, title);
    await goToNote(page, noteId);

    const typed = `Hello world e2e ${Date.now()}`;
    await typeInEditor(page, typed);

    // Wait for "Saved" to appear in the topbar (debounce 1s + API roundtrip).
    // "Saving..." is transient — assert only the settled "Saved" state.
    await expect(
      page.getByText("Saved", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Reload and verify persistence
    await page.reload();
    await page.waitForSelector(".bn-editor", { timeout: 20000 });
    await expect(page.locator(".bn-editor")).toContainText(typed, {
      timeout: 8000,
    });
  });

  // ---- Scenario 2: slash menu 5 AI items --------------------------------

  test("scenario 2: slash menu opens with all 5 AI items", async ({ page }) => {
    const noteId = await createNote(page, `SlashMenu Test ${Date.now()}`);
    await goToNote(page, noteId);

    await typeInEditor(page, "/");
    await page.waitForSelector("#bn-suggestion-menu", { timeout: 8000 });

    const menu = page.locator("#bn-suggestion-menu");

    // Match first occurrence to avoid strict-mode violation when title+subtitle both match.
    // Ask AI
    await expect(
      menu.getByText(/Ask AI/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Summarize
    await expect(
      menu.getByText(/^Summarize$/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Digest
    await expect(
      menu.getByText(/^Digest$/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Agent
    await expect(
      menu.getByText(/^Agent$/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // RSS Feed
    await expect(
      menu.getByText(/RSS Feed/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ---- Scenario 3: /ask hello + Enter via stubbed notes-agent -----------

  test("scenario 3: /ask hello + Enter via stubbed notes-agent", async ({
    page,
  }) => {
    await page.route("**/api/ai/notes-agent", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/plain" },
        body: AGENT_STREAM_BODY,
      });
    });

    const noteId = await createNote(page, `Ask Test ${Date.now()}`);
    await goToNote(page, noteId);

    await typeInEditor(page, "/ask hello");
    await page.keyboard.press("Enter");

    // "# Test Heading" is parsed by tryParseMarkdownToBlocks into a heading block.
    await expect(page.locator(".bn-editor")).toContainText("Test Heading", {
      timeout: 15000,
    });
    await expect(page.locator(".bn-editor")).toContainText("Item one", {
      timeout: 5000,
    });
  });

  // ---- Scenario 4: inbox disableAiCommands omits AI items ---------------

  test("scenario 4: inbox disableAiCommands omits AI items from slash menu", async ({
    page,
  }) => {
    await page.goto("/inbox");
    // Wait for inbox to fully load (auto-creates inbox note via POST /api/inbox/note)
    await page.waitForSelector(".bn-editor", { timeout: 25000 });

    // Type some content first so the editor has a settled block
    await typeInEditor(page, "Some content");
    // Open a new empty block with Enter, then type "/" to trigger slash menu
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    await page.waitForSelector("#bn-suggestion-menu", { timeout: 8000 });
    const menu = page.locator("#bn-suggestion-menu");

    // AI items must NOT be present when disableAiCommands={true}
    const aiTextRegex = /^(Ask AI|Summarize|Digest|Agent|RSS Feed)$/i;
    const aiItems = menu.getByText(aiTextRegex);
    await expect(aiItems).toHaveCount(0, { timeout: 3000 });

    // Built-in items must be present (verify slash menu is actually working)
    await expect(
      menu.getByText(/Heading 1/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ---- Scenario 5: @-mention duplicate titles ---------------------------

  test("scenario 5: @-mention with duplicate titles renders both as distinct", async ({
    page,
  }) => {
    const dupTitle = `Dup test ${Date.now()}`;
    // Create 2 notes with identical titles
    await createNote(page, dupTitle);
    await createNote(page, dupTitle);

    // Create a third note to work from
    const id3 = await createNote(page, `Mention Host ${Date.now()}`);
    await goToNote(page, id3);

    // Wait for the sidebar/notes list to load so NoteEditor receives notes prop
    // The sidebar renders note items once useNotes() fetches the data.
    // Wait for at least one note link to be visible in sidebar.
    await page.waitForSelector('[class*="notes-sidebar"] a, .notes-item, [data-note-id]', {
      timeout: 10000,
    }).catch(async () => {
      // Fallback: just wait for networkidle to ensure useNotes has fetched
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    });
    // Brief pause to allow React to re-render NoteEditor with updated notes prop
    await page.waitForTimeout(500);

    await typeInEditor(page, "@");

    // Wait for the @-mention suggestion menu to appear
    await page.waitForSelector("#bn-suggestion-menu", { timeout: 10000 });

    // Both duplicate-titled notes should appear as distinct items
    const items = page.locator("#bn-suggestion-menu .bn-suggestion-menu-item");
    const dupItems = items.filter({ hasText: dupTitle });
    await expect(dupItems).toHaveCount(2, { timeout: 5000 });

    // Verify both have different index-based ids (regression for key-collision bug)
    const firstId = await dupItems.nth(0).getAttribute("id");
    const secondId = await dupItems.nth(1).getAttribute("id");
    expect(firstId).not.toBe(secondId);
  });

  // ---- Scenario 6: /rss no subs -> modal -> subscribe -> digest block ---

  test("scenario 6: /rss no subs -> onboarding modal -> subscribe -> digest block", async ({
    page,
  }) => {
    // No subscriptions initially
    await page.route("**/api/rss", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true, data: [] }),
        });
      } else if (method === "POST") {
        // Subscribe endpoint
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true, data: {} }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/ai/notes-rss", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: RSS_STREAM_BODY,
      });
    });

    const noteId = await createNote(page, `RSS No Subs ${Date.now()}`);
    await goToNote(page, noteId);

    await typeInEditor(page, "/rss");
    await page.keyboard.press("Enter");

    // Wait for RSSOnboardingModal (role="dialog")
    await expect(
      page.getByRole("dialog"),
    ).toBeVisible({ timeout: 12000 });

    // Select the first available category button in the modal
    const categoryBtn = page
      .getByRole("dialog")
      .locator("button")
      .filter({
        hasText: /Technology|Science|Design|World News|Development|AI|Academic/,
      })
      .first();
    await categoryBtn.click();

    // Click the Subscribe confirm button (enabled after at least 1 selection)
    const confirmBtn = page.getByRole("dialog").getByRole("button", {
      name: /Subscribe/i,
    });
    await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
    await confirmBtn.click();

    // Modal closes and digest appears in the editor
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 12000 });
    await expect(page.locator(".bn-editor")).toContainText(
      /Today's Digest|Example Article/,
      { timeout: 25000 },
    );
  });

  // ---- Scenario 7: /agent help + Enter via stubbed notes-agentic ---------

  test("scenario 7: /agent help + Enter via stubbed notes-agentic", async ({
    page,
  }) => {
    await page.route("**/api/ai/notes-agentic", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: AGENTIC_STREAM_BODY,
      });
    });

    const noteId = await createNote(page, `Agent Test ${Date.now()}`);
    await goToNote(page, noteId);

    await typeInEditor(page, "/agent help");
    await page.keyboard.press("Enter");

    // Assert final state after stream completes
    await expect(page.locator(".bn-editor")).toContainText("Hello", {
      timeout: 15000,
    });
    await expect(page.locator(".bn-editor")).toContainText("from the agent", {
      timeout: 5000,
    });
    await expect(page.locator(".bn-editor")).toContainText("Point one", {
      timeout: 5000,
    });
    await expect(page.locator(".bn-editor")).toContainText("Point two", {
      timeout: 5000,
    });
  });

  // ---- Scenario 8: /agent createReminder -> side-effect block ------------

  test("scenario 8: /agent createReminder -> side-effect block injection", async ({
    page,
  }) => {
    await page.route("**/api/ai/notes-agentic", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: AGENTIC_WITH_REMINDER_BODY,
      });
    });

    const noteId = await createNote(page, `Reminder Test ${Date.now()}`);
    await goToNote(page, noteId);

    await typeInEditor(page, "/agent create a reminder for tomorrow 9am");
    await page.keyboard.press("Enter");

    // Main response text from fixture text-delta
    await expect(page.locator(".bn-editor")).toContainText("Reminder set", {
      timeout: 15000,
    });

    // Side-effect italic block: "Action performed: Test reminder (2024-01-01T09:00:00Z)"
    await expect(page.locator(".bn-editor")).toContainText(
      /Action performed:|已執行操作：/,
      { timeout: 8000 },
    );
    await expect(page.locator(".bn-editor")).toContainText("Test reminder", {
      timeout: 5000,
    });
    await expect(page.locator(".bn-editor")).toContainText(
      "2024-01-01T09:00:00Z",
      { timeout: 5000 },
    );
  });

  // ---- Scenario 9: /rss with existing subs -> no modal -> digest ---------

  test("scenario 9: /rss with existing subs -> no modal -> digest block", async ({
    page,
  }) => {
    // Existing subscription: GET returns data
    await page.route("**/api/rss", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: true,
            data: [
              { url: "https://example.com/feed.xml", category: "Tech" },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/ai/notes-rss", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: RSS_STREAM_BODY,
      });
    });

    const noteId = await createNote(page, `RSS With Subs ${Date.now()}`);
    await goToNote(page, noteId);

    await typeInEditor(page, "/rss");
    await page.keyboard.press("Enter");

    // Modal must NOT appear (subscriptions exist)
    // Wait briefly, then assert dialog is absent
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Digest block should appear in the editor
    await expect(page.locator(".bn-editor")).toContainText(
      /Today's Digest|Example Article/,
      { timeout: 25000 },
    );
  });

});
