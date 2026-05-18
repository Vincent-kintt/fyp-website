/**
 * Notes subtree duplicate e2e regression.
 *
 * Covers the post-shipping behavior of POST /api/notes/[id]/duplicate +
 * executeDuplicateNote (hooks/useNotes.js):
 *   - Folder + children: server copies subtree, hook fires
 *     "notesDuplicatedCount" toast (plural), sidebar shows "<title> (copy)"
 *     with the same number of children re-parented under it.
 *   - Single leaf note: hook fires singular "noteDuplicated" toast (M2 path).
 *
 * Auth comes from the shared storageState wired in e2e/playwright.config.js,
 * matching the pattern in notes-editor.spec.js. The shared test account
 * accumulates state between runs, so beforeEach removes any prior
 * "E2E-DupSub*" notes via the trash + permanent-delete API surface.
 */

import { test, expect } from "@playwright/test";

const TITLE_PREFIX = "E2E-DupSub";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a note via POST /api/notes and return its id.
 * Mirrors the helper in notes-editor.spec.js.
 */
async function createNote(page, title, parentId = null) {
  const res = await page.request.post("/api/notes", {
    data: parentId ? { title, parentId } : { title },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data.id;
}

/**
 * Trash + permanently purge all notes whose title starts with the E2E-DupSub
 * prefix. Keeps the shared test account tidy across reruns. The DELETE
 * endpoint is idempotent: first call soft-deletes, second call (on a doc
 * already in trash) permanently removes it.
 */
async function cleanupDupSubNotes(page) {
  // Pass 1: live notes -> trash
  const listRes = await page.request.get("/api/notes");
  if (listRes.ok()) {
    const listBody = await listRes.json();
    const notes = Array.isArray(listBody?.data) ? listBody.data : [];
    for (const n of notes) {
      if (typeof n.title === "string" && n.title.startsWith(TITLE_PREFIX)) {
        await page.request.delete(`/api/notes/${n.id}`).catch(() => {});
      }
    }
  }

  // Pass 2: trashed notes -> permanent delete
  const trashRes = await page.request.get("/api/notes/trash").catch(() => null);
  if (trashRes && trashRes.ok()) {
    const trashBody = await trashRes.json();
    const trashed = Array.isArray(trashBody?.data) ? trashBody.data : [];
    for (const n of trashed) {
      if (typeof n.title === "string" && n.title.startsWith(TITLE_PREFIX)) {
        await page.request.delete(`/api/notes/${n.id}`).catch(() => {});
      }
    }
  }
}

/**
 * Ensure the sidebar Notes tree (PageTree) is mounted. Sidebar.js renders
 * the section only when notesExpanded === true AND notes.length > 0.
 *
 * On `/notes` routes Sidebar.js auto-sets notesExpanded=true via effect
 * (`if (isNotesPage) setNotesExpanded(true)`), so the tree should already
 * be present after navigation. Clicking the NOTES toggle in that state
 * would COLLAPSE the section. We therefore wait for the tree container
 * first, and only click the toggle if it's still collapsed after a short
 * grace period.
 */
async function openNotesSidebar(page) {
  const toggle = page.getByRole("button", { name: /^NOTES$/ });
  await toggle.waitFor({ state: "visible", timeout: 10000 });

  // Probe for any tree item or the empty-state copy. If neither appears
  // within 2s, the section is collapsed and we need to click the toggle.
  const anyTreeItem = page.locator(".notes-tree-item").first();
  const emptyState = page.getByText("No pages yet", { exact: true });
  const alreadyOpen = await anyTreeItem
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() =>
      emptyState
        .waitFor({ state: "visible", timeout: 500 })
        .then(() => true)
        .catch(() => false),
    );
  if (!alreadyOpen) {
    await toggle.click();
  }
}

/**
 * Locate a sidebar tree item by visible title text. Returns the inner
 * .notes-tree-item element so we can hover it to reveal action buttons.
 */
function treeItem(page, title) {
  return page
    .locator(".notes-tree-item")
    .filter({ hasText: title });
}

/**
 * Hover a tree item to reveal the MoreHorizontal "Actions" button, click it,
 * then click the Duplicate menuitem.
 */
async function openMenuAndDuplicate(page, title) {
  const item = treeItem(page, title).first();
  await item.waitFor({ state: "visible", timeout: 10000 });
  await item.hover();

  const actionsBtn = item.getByRole("button", { name: "Actions" });
  await actionsBtn.waitFor({ state: "visible", timeout: 5000 });
  await actionsBtn.click();

  // Menu mounts at document level; locate by role + visible label.
  const menu = page.locator('[role="menu"]');
  await menu.waitFor({ state: "visible", timeout: 5000 });
  const duplicateBtn = menu.getByRole("menuitem", { name: /Duplicate/i });
  await duplicateBtn.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Notes subtree duplicate", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupDupSubNotes(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupDupSubNotes(page);
  });

  test("folder with 2 children: plural toast + sidebar shows (copy)", async ({
    page,
  }) => {
    const folderTitle = `${TITLE_PREFIX} Folder`;
    const childATitle = `${TITLE_PREFIX} Child A`;
    const childBTitle = `${TITLE_PREFIX} Child B`;

    // Seed the tree via API — faster and less flaky than driving the sidebar
    // create flow, which is well-covered elsewhere.
    const folderId = await createNote(page, folderTitle);
    await createNote(page, childATitle, folderId);
    await createNote(page, childBTitle, folderId);

    // Navigate to /notes so the sidebar with PageTree is mounted on a notes
    // route. useNotes will fetch the freshly-seeded notes.
    await page.goto("/notes");
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    await openNotesSidebar(page);

    // Wait until the seeded folder is visible in the tree before driving the
    // menu — otherwise the hover would race against useNotes settling.
    await expect(treeItem(page, folderTitle).first()).toBeVisible({
      timeout: 10000,
    });

    await openMenuAndDuplicate(page, folderTitle);

    // Plural toast: source + 2 children = 3 copied docs.
    await expect(
      page.getByText("Duplicated 3 notes", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Sidebar now contains the "(copy)" entry.
    const copyTitle = `${folderTitle} (copy)`;
    await expect(treeItem(page, copyTitle).first()).toBeVisible({
      timeout: 10000,
    });

    // The two original child titles must each appear twice — once under the
    // source folder, once under the (copy) folder.
    await expect(treeItem(page, childATitle)).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(treeItem(page, childBTitle)).toHaveCount(2, {
      timeout: 10000,
    });
  });

  test("single leaf note: singular toast (M2 path)", async ({ page }) => {
    const leafTitle = `${TITLE_PREFIX} Leaf`;
    await createNote(page, leafTitle);

    await page.goto("/notes");
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    await openNotesSidebar(page);
    await expect(treeItem(page, leafTitle).first()).toBeVisible({
      timeout: 10000,
    });

    await openMenuAndDuplicate(page, leafTitle);

    // Singular toast: copiedCount === 1.
    await expect(
      page.getByText("Duplicated note", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Sidebar shows the "(copy)" sibling. Original leaf must still be there.
    await expect(treeItem(page, `${leafTitle} (copy)`).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(treeItem(page, leafTitle)).toHaveCount(2, {
      timeout: 10000,
    });
  });
});
