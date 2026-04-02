# Notes System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notion-style block-editor notes system with page tree sidebar, inline AI commands, and mobile support to the existing FYP Reminder App.

**Architecture:** New `/notes` route with split-pane layout (page tree sidebar + BlockNote editor). Data stored in MongoDB `notes` collection with adjacency-list nesting via `parentId`. AI inline commands (`/ask`, `/summarize`, `/digest`) use existing `streamText` + `getModel()` infrastructure via a dedicated `/api/ai/notes-agent` endpoint. Frontend follows existing patterns — CSS variables for theming, `@dnd-kit` for drag-and-drop, `next-intl` for i18n.

**Tech Stack:** Next.js 15, BlockNote (`@blocknote/core`, `@blocknote/react`, `@blocknote/mantine`), MongoDB native driver, Vercel AI SDK 6, `@dnd-kit`, Tailwind CSS 4, next-intl 4

**Design:** Flat design, existing CSS variable system (`--accent`, `--surface-*`, `--glass-*`, `--text-*`). Transitions 150–200ms with `var(--ease-standard)`. WCAG AA contrast. Touch targets ≥ 44px. `prefers-reduced-motion` respected via existing global rule.

**Spec:** `docs/superpowers/specs/2026-04-03-notes-system-design.md`

---

## File Structure

```
New files:
  lib/notes/tree.js              — pure functions: buildTree, flattenTree, findAncestors
  lib/notes/db.js                — MongoDB CRUD helpers for notes collection
  lib/notes/commands.js          — parse inline AI commands from slash text

  app/api/notes/route.js         — GET (list all), POST (create)
  app/api/notes/[noteId]/route.js — GET, PATCH, DELETE (with cascade)
  app/api/notes/reorder/route.js — POST (batch sortOrder update)
  app/api/ai/notes-agent/route.js — POST (streaming AI for inline commands)

  app/[locale]/(app)/notes/page.js          — Notes home (redirect or empty state)
  app/[locale]/(app)/notes/[noteId]/page.js — Single note view (tree + editor)
  app/[locale]/(app)/notes/layout.js        — Notes-specific full-width layout (overrides max-w-7xl)

  components/notes/NotesLayout.js   — split pane: sidebar + editor area
  components/notes/PageTree.js      — sidebar tree with new-page button
  components/notes/PageTreeItem.js  — single tree node (expand, context menu)
  components/notes/NoteEditor.js    — BlockNote wrapper with auto-save
  components/notes/CommandBlock.js  — custom AI command block (purple accent)
  components/notes/ResponseBlock.js — custom AI response block (glass bg)
  components/notes/MobileSidebar.js — slide-in drawer for mobile page tree

  tests/unit/notes-tree.test.js             — tree building pure functions
  tests/unit/notes-commands.test.js         — command parsing
  tests/integration/notes-api.test.js       — CRUD API routes
  tests/integration/notes-id-api.test.js    — single note API (GET/PATCH/DELETE + cascade)
  tests/integration/notes-reorder-api.test.js — reorder API

Modified files:
  auth.config.js:35-39           — add /notes to protected routes
  components/layout/Navbar.js:18,85-112 — add Notes nav link with FaStickyNote icon
  messages/en.json               — add notes.* and nav.notes keys
  messages/zh-TW.json            — add notes.* and nav.notes keys
  app/globals.css                — add notes-specific CSS (command block, sidebar)
```

---

## Task 1: Note Tree Utilities

**Files:**
- Create: `lib/notes/tree.js`
- Test: `tests/unit/notes-tree.test.js`

- [ ] **Step 1: Write failing tests for `buildTree`**

```js
// tests/unit/notes-tree.test.js
import { describe, it, expect } from "vitest";
import { buildTree, findAncestors } from "@/lib/notes/tree.js";

describe("buildTree", () => {
  it("builds nested tree from flat notes array", () => {
    const flat = [
      { id: "a", parentId: null, title: "Root A", sortOrder: 1000 },
      { id: "b", parentId: "a", title: "Child B", sortOrder: 1000 },
      { id: "c", parentId: "a", title: "Child C", sortOrder: 2000 },
      { id: "d", parentId: null, title: "Root D", sortOrder: 2000 },
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe("a");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].id).toBe("b");
    expect(tree[0].children[1].id).toBe("c");
    expect(tree[1].id).toBe("d");
    expect(tree[1].children).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("sorts siblings by sortOrder", () => {
    const flat = [
      { id: "a", parentId: null, title: "Second", sortOrder: 2000 },
      { id: "b", parentId: null, title: "First", sortOrder: 1000 },
    ];
    const tree = buildTree(flat);
    expect(tree[0].id).toBe("b");
    expect(tree[1].id).toBe("a");
  });

  it("handles orphaned children gracefully", () => {
    const flat = [
      { id: "a", parentId: "nonexistent", title: "Orphan", sortOrder: 1000 },
    ];
    const tree = buildTree(flat);
    // Orphans treated as root nodes
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
  });
});

describe("findAncestors", () => {
  it("returns ancestor ids from child to root", () => {
    const flat = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    const ancestors = findAncestors(flat, "c");
    expect(ancestors).toEqual(["b", "a"]);
  });

  it("returns empty array for root node", () => {
    const flat = [{ id: "a", parentId: null }];
    expect(findAncestors(flat, "a")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/notes-tree.test.js`
Expected: FAIL — module `@/lib/notes/tree.js` not found

- [ ] **Step 3: Implement tree utilities**

```js
// lib/notes/tree.js

/**
 * Build nested tree from flat notes array using parentId adjacency list.
 * @param {Array<{id: string, parentId: string|null, sortOrder: number}>} flat
 * @returns {Array<{...note, children: Array}>}
 */
export function buildTree(flat) {
  const map = new Map();
  const roots = [];

  // Index all nodes
  for (const note of flat) {
    map.set(note.id, { ...note, children: [] });
  }

  // Build parent-child relationships
  for (const note of flat) {
    const node = map.get(note.id);
    if (note.parentId && map.has(note.parentId)) {
      map.get(note.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort siblings by sortOrder
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

/**
 * Find all ancestor IDs of a note, from immediate parent to root.
 * @param {Array<{id: string, parentId: string|null}>} flat
 * @param {string} noteId
 * @returns {string[]}
 */
export function findAncestors(flat, noteId) {
  const map = new Map(flat.map((n) => [n.id, n]));
  const ancestors = [];
  let current = map.get(noteId);
  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = map.get(current.parentId);
  }
  return ancestors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/notes-tree.test.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/notes/tree.js tests/unit/notes-tree.test.js
git commit -m "feat(notes): add tree building utilities with tests"
```

---

## Task 2: Command Parsing Utilities

**Files:**
- Create: `lib/notes/commands.js`
- Test: `tests/unit/notes-commands.test.js`

- [ ] **Step 1: Write failing tests for command parsing**

```js
// tests/unit/notes-commands.test.js
import { describe, it, expect } from "vitest";
import { parseCommand } from "@/lib/notes/commands.js";

describe("parseCommand", () => {
  it("parses /ask command with input", () => {
    const result = parseCommand("/ask What is RAG?");
    expect(result).toEqual({ type: "ask", input: "What is RAG?" });
  });

  it("parses /summarize with URL", () => {
    const result = parseCommand("/summarize https://example.com");
    expect(result).toEqual({ type: "summarize", input: "https://example.com" });
  });

  it("parses /summarize without input", () => {
    const result = parseCommand("/summarize");
    expect(result).toEqual({ type: "summarize", input: "" });
  });

  it("parses /digest (no input expected)", () => {
    const result = parseCommand("/digest");
    expect(result).toEqual({ type: "digest", input: "" });
  });

  it("returns null for unknown commands", () => {
    expect(parseCommand("/unknown foo")).toBeNull();
  });

  it("returns null for non-command text", () => {
    expect(parseCommand("just regular text")).toBeNull();
  });

  it("trims whitespace from input", () => {
    const result = parseCommand("/ask   What is AI?  ");
    expect(result).toEqual({ type: "ask", input: "What is AI?" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/notes-commands.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement command parser**

```js
// lib/notes/commands.js

const COMMANDS = new Set(["ask", "summarize", "digest"]);

/**
 * Parse an inline AI command string.
 * @param {string} text - e.g. "/ask What is RAG?"
 * @returns {{ type: string, input: string } | null}
 */
export function parseCommand(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIndex = trimmed.indexOf(" ");
  const command = spaceIndex === -1
    ? trimmed.slice(1)
    : trimmed.slice(1, spaceIndex);

  if (!COMMANDS.has(command)) return null;

  const input = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1).trim();
  return { type: command, input };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/notes-commands.test.js`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/notes/commands.js tests/unit/notes-commands.test.js
git commit -m "feat(notes): add AI command parser with tests"
```

---

## Task 3: Notes DB Helpers

**Files:**
- Create: `lib/notes/db.js`

- [ ] **Step 1: Implement DB helpers**

These are thin wrappers around `getCollection` following the existing `lib/db.js` pattern. They'll be tested through the API route integration tests in Tasks 4–6.

```js
// lib/notes/db.js
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";

/**
 * Get the notes collection.
 */
export async function getNotesCollection() {
  return getCollection("notes");
}

/**
 * Format a raw MongoDB note document for API response.
 */
export function formatNote(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    title: doc.title,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    content: doc.content || [],
    icon: doc.icon || null,
    sortOrder: doc.sortOrder || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Recursively find all descendant note IDs for cascade delete.
 * @param {Collection} collection
 * @param {string} userId
 * @param {ObjectId} parentId
 * @returns {Promise<ObjectId[]>}
 */
export async function findDescendantIds(collection, userId, parentId) {
  const children = await collection
    .find({ userId, parentId })
    .project({ _id: 1 })
    .toArray();

  const ids = children.map((c) => c._id);
  for (const child of children) {
    const grandchildren = await findDescendantIds(collection, userId, child._id);
    ids.push(...grandchildren);
  }
  return ids;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/notes/db.js
git commit -m "feat(notes): add MongoDB helper functions"
```

---

## Task 4: Notes API — List and Create

**Files:**
- Create: `app/api/notes/route.js`
- Test: `tests/integration/notes-api.test.js`

- [ ] **Step 1: Write failing integration tests**

```js
// tests/integration/notes-api.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import { setupApiMocks, mockSession, createRequest, parseResponse } from "../helpers/api.js";

setupApiMocks(getDb);

const { GET, POST } = await import("@/app/api/notes/route.js");

const TEST_USER = { id: "user-notes-1", username: "noteuser", role: "user" };
const OTHER_USER = { id: "user-notes-2", username: "other", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("GET /api/notes", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(createRequest("GET", "/api/notes"));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns all notes for authenticated user", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("notes").insertMany([
      { userId: TEST_USER.id, title: "Note A", parentId: null, content: [], sortOrder: 1000, createdAt: new Date(), updatedAt: new Date() },
      { userId: TEST_USER.id, title: "Note B", parentId: null, content: [], sortOrder: 2000, createdAt: new Date(), updatedAt: new Date() },
      { userId: OTHER_USER.id, title: "Other note", parentId: null, content: [], sortOrder: 1000, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(createRequest("GET", "/api/notes"));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data.every((n) => n.id)).toBe(true);
  });

  it("returns notes sorted by updatedAt descending", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("notes").insertMany([
      { userId: TEST_USER.id, title: "Older", parentId: null, content: [], sortOrder: 1000, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
      { userId: TEST_USER.id, title: "Newer", parentId: null, content: [], sortOrder: 2000, createdAt: new Date("2026-04-01"), updatedAt: new Date("2026-04-01") },
    ]);

    const res = await GET(createRequest("GET", "/api/notes"));
    const { body } = await parseResponse(res);
    expect(body.data[0].title).toBe("Newer");
  });
});

describe("POST /api/notes", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(createRequest("POST", "/api/notes", {
      body: { title: "Test" },
    }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("creates a root-level note", async () => {
    mockSession(TEST_USER);
    const res = await POST(createRequest("POST", "/api/notes", {
      body: { title: "My Note" },
    }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("My Note");
    expect(body.data.parentId).toBeNull();
    expect(body.data.id).toBeDefined();
  });

  it("creates a child note with parentId", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const parent = await db.collection("notes").insertOne({
      userId: TEST_USER.id, title: "Parent", parentId: null,
      content: [], sortOrder: 1000, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await POST(createRequest("POST", "/api/notes", {
      body: { title: "Child", parentId: parent.insertedId.toString() },
    }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.data.parentId).toBe(parent.insertedId.toString());
  });

  it("rejects empty title", async () => {
    mockSession(TEST_USER);
    const res = await POST(createRequest("POST", "/api/notes", {
      body: { title: "" },
    }));
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/integration/notes-api.test.js`
Expected: FAIL — route module not found

- [ ] **Step 3: Implement the API route**

```js
// app/api/notes/route.js
import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

// GET /api/notes — list all notes for user (flat, for tree building)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const col = await getNotesCollection();
    const notes = await col
      .find({ userId: session.user.id })
      .sort({ updatedAt: -1 })
      .toArray();

    return apiSuccess(notes.map(formatNote));
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return apiError("Internal server error", 500);
  }
}

// POST /api/notes — create new note
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { title, parentId, icon } = body;

    if (!title || !title.trim()) {
      return apiError("Title is required", 400);
    }
    if (title.length > 200) {
      return apiError("Title must be 200 characters or less", 400);
    }

    const col = await getNotesCollection();

    // Compute sortOrder: max among siblings + 1000
    const parentOid = parentId ? new ObjectId(parentId) : null;
    const lastSibling = await col
      .find({ userId: session.user.id, parentId: parentOid })
      .sort({ sortOrder: -1 })
      .limit(1)
      .toArray();
    const sortOrder = lastSibling.length > 0
      ? lastSibling[0].sortOrder + 1000
      : 1000;

    const newNote = {
      userId: session.user.id,
      title: title.trim(),
      parentId: parentOid,
      content: [],
      icon: icon || null,
      sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await col.insertOne(newNote);
    return apiSuccess(formatNote({ ...newNote, _id: result.insertedId }), 201);
  } catch (error) {
    console.error("POST /api/notes error:", error);
    return apiError("Internal server error", 500);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/integration/notes-api.test.js`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/notes/route.js tests/integration/notes-api.test.js
git commit -m "feat(notes): add list and create API routes with tests"
```

---

## Task 5: Notes API — Get, Update, Delete (Single Note)

**Files:**
- Create: `app/api/notes/[noteId]/route.js`
- Test: `tests/integration/notes-id-api.test.js`

- [ ] **Step 1: Write failing integration tests**

```js
// tests/integration/notes-id-api.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import { setupApiMocks, mockSession, createRequest, parseResponse, params } from "../helpers/api.js";

setupApiMocks(getDb);

const { GET, PATCH, DELETE } = await import("@/app/api/notes/[noteId]/route.js");

const TEST_USER = { id: "user-nid-1", username: "noteuser", role: "user" };

let testNoteId;

beforeAll(async () => {
  await startDb("test_notes_id_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  const db = getDb();
  const result = await db.collection("notes").insertOne({
    userId: TEST_USER.id, title: "Test Note", parentId: null,
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    icon: null, sortOrder: 1000, createdAt: new Date(), updatedAt: new Date(),
  });
  testNoteId = result.insertedId.toString();
});

describe("GET /api/notes/[noteId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(createRequest("GET", `/api/notes/${testNoteId}`), params({ noteId: testNoteId }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns the note with content", async () => {
    mockSession(TEST_USER);
    const res = await GET(createRequest("GET", `/api/notes/${testNoteId}`), params({ noteId: testNoteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.title).toBe("Test Note");
    expect(body.data.content).toHaveLength(1);
  });

  it("returns 404 for non-existent note", async () => {
    mockSession(TEST_USER);
    const fakeId = new ObjectId().toString();
    const res = await GET(createRequest("GET", `/api/notes/${fakeId}`), params({ noteId: fakeId }));
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });
});

describe("PATCH /api/notes/[noteId]", () => {
  it("updates title", async () => {
    mockSession(TEST_USER);
    const res = await PATCH(
      createRequest("PATCH", `/api/notes/${testNoteId}`, { body: { title: "Updated Title" } }),
      params({ noteId: testNoteId }),
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.title).toBe("Updated Title");
  });

  it("updates content", async () => {
    mockSession(TEST_USER);
    const newContent = [{ type: "paragraph", content: [{ type: "text", text: "New content" }] }];
    const res = await PATCH(
      createRequest("PATCH", `/api/notes/${testNoteId}`, { body: { content: newContent } }),
      params({ noteId: testNoteId }),
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.content[0].content[0].text).toBe("New content");
  });

  it("updates parentId (move note)", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const parent = await db.collection("notes").insertOne({
      userId: TEST_USER.id, title: "New Parent", parentId: null,
      content: [], sortOrder: 2000, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await PATCH(
      createRequest("PATCH", `/api/notes/${testNoteId}`, {
        body: { parentId: parent.insertedId.toString() },
      }),
      params({ noteId: testNoteId }),
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.parentId).toBe(parent.insertedId.toString());
  });
});

describe("DELETE /api/notes/[noteId]", () => {
  it("deletes a note and its children (cascade)", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const parentId = new ObjectId(testNoteId);

    // Insert child and grandchild
    const child = await db.collection("notes").insertOne({
      userId: TEST_USER.id, title: "Child", parentId,
      content: [], sortOrder: 1000, createdAt: new Date(), updatedAt: new Date(),
    });
    await db.collection("notes").insertOne({
      userId: TEST_USER.id, title: "Grandchild", parentId: child.insertedId,
      content: [], sortOrder: 1000, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await DELETE(
      createRequest("DELETE", `/api/notes/${testNoteId}`),
      params({ noteId: testNoteId }),
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(200);

    // All 3 notes should be gone
    const remaining = await db.collection("notes").countDocuments({ userId: TEST_USER.id });
    expect(remaining).toBe(0);
  });

  it("returns 404 for non-existent note", async () => {
    mockSession(TEST_USER);
    const fakeId = new ObjectId().toString();
    const res = await DELETE(createRequest("DELETE", `/api/notes/${fakeId}`), params({ noteId: fakeId }));
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/integration/notes-id-api.test.js`
Expected: FAIL — route module not found

- [ ] **Step 3: Implement the single-note API route**

```js
// app/api/notes/[noteId]/route.js
import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection, formatNote, findDescendantIds } from "@/lib/notes/db";

// GET /api/notes/[noteId]
export async function GET(request, segmentData) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { noteId } = await segmentData.params;
    if (!ObjectId.isValid(noteId)) return apiError("Invalid note ID", 400);

    const col = await getNotesCollection();
    const note = await col.findOne({
      _id: new ObjectId(noteId),
      userId: session.user.id,
    });

    if (!note) return apiError("Note not found", 404);
    return apiSuccess(formatNote(note));
  } catch (error) {
    console.error("GET /api/notes/[noteId] error:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/notes/[noteId]
export async function PATCH(request, segmentData) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { noteId } = await segmentData.params;
    if (!ObjectId.isValid(noteId)) return apiError("Invalid note ID", 400);

    const body = await request.json();
    const { title, content, parentId, icon, sortOrder } = body;

    const update = { updatedAt: new Date() };
    if (title !== undefined) {
      if (!title.trim()) return apiError("Title cannot be empty", 400);
      if (title.length > 200) return apiError("Title must be 200 characters or less", 400);
      update.title = title.trim();
    }
    if (content !== undefined) update.content = content;
    if (parentId !== undefined) {
      update.parentId = parentId ? new ObjectId(parentId) : null;
    }
    if (icon !== undefined) update.icon = icon;
    if (sortOrder !== undefined) update.sortOrder = sortOrder;

    const col = await getNotesCollection();
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(noteId), userId: session.user.id },
      { $set: update },
      { returnDocument: "after" },
    );

    if (!result) return apiError("Note not found", 404);
    return apiSuccess(formatNote(result));
  } catch (error) {
    console.error("PATCH /api/notes/[noteId] error:", error);
    return apiError("Internal server error", 500);
  }
}

// DELETE /api/notes/[noteId] — cascade deletes children
export async function DELETE(request, segmentData) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { noteId } = await segmentData.params;
    if (!ObjectId.isValid(noteId)) return apiError("Invalid note ID", 400);

    const col = await getNotesCollection();
    const oid = new ObjectId(noteId);

    const note = await col.findOne({ _id: oid, userId: session.user.id });
    if (!note) return apiError("Note not found", 404);

    // Find all descendants for cascade delete
    const descendantIds = await findDescendantIds(col, session.user.id, oid);
    const idsToDelete = [oid, ...descendantIds];

    await col.deleteMany({
      _id: { $in: idsToDelete },
      userId: session.user.id,
    });

    return apiSuccess({ deleted: idsToDelete.length });
  } catch (error) {
    console.error("DELETE /api/notes/[noteId] error:", error);
    return apiError("Internal server error", 500);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/integration/notes-id-api.test.js`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/notes/[noteId]/route.js tests/integration/notes-id-api.test.js
git commit -m "feat(notes): add single-note CRUD API with cascade delete"
```

---

## Task 6: Notes Reorder API

**Files:**
- Create: `app/api/notes/reorder/route.js`
- Test: `tests/integration/notes-reorder-api.test.js`

- [ ] **Step 1: Write failing integration test**

```js
// tests/integration/notes-reorder-api.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import { setupApiMocks, mockSession, createRequest, parseResponse } from "../helpers/api.js";

setupApiMocks(getDb);

const { POST } = await import("@/app/api/notes/reorder/route.js");

const TEST_USER = { id: "user-reorder-1", username: "reorderuser", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_reorder");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("POST /api/notes/reorder", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(createRequest("POST", "/api/notes/reorder", {
      body: { updates: [] },
    }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("batch updates sortOrder and parentId", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const notes = await db.collection("notes").insertMany([
      { userId: TEST_USER.id, title: "A", parentId: null, content: [], sortOrder: 1000, createdAt: new Date(), updatedAt: new Date() },
      { userId: TEST_USER.id, title: "B", parentId: null, content: [], sortOrder: 2000, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const [idA, idB] = Object.values(notes.insertedIds).map((id) => id.toString());

    const res = await POST(createRequest("POST", "/api/notes/reorder", {
      body: {
        updates: [
          { id: idB, sortOrder: 1000, parentId: null },
          { id: idA, sortOrder: 2000, parentId: null },
        ],
      },
    }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Verify in DB
    const noteB = await db.collection("notes").findOne({ _id: notes.insertedIds[1] });
    expect(noteB.sortOrder).toBe(1000);
  });

  it("rejects empty updates array", async () => {
    mockSession(TEST_USER);
    const res = await POST(createRequest("POST", "/api/notes/reorder", {
      body: { updates: [] },
    }));
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/integration/notes-reorder-api.test.js`
Expected: FAIL — route module not found

- [ ] **Step 3: Implement reorder route**

```js
// app/api/notes/reorder/route.js
import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection } from "@/lib/notes/db";

// POST /api/notes/reorder — batch update sortOrder and optional parentId
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return apiError("Updates array is required and must not be empty", 400);
    }

    const col = await getNotesCollection();
    const ops = updates.map(({ id, sortOrder, parentId }) => ({
      updateOne: {
        filter: { _id: new ObjectId(id), userId: session.user.id },
        update: {
          $set: {
            sortOrder,
            parentId: parentId ? new ObjectId(parentId) : null,
            updatedAt: new Date(),
          },
        },
      },
    }));

    await col.bulkWrite(ops);
    return apiSuccess({ updated: updates.length });
  } catch (error) {
    console.error("POST /api/notes/reorder error:", error);
    return apiError("Internal server error", 500);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/integration/notes-reorder-api.test.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/notes/reorder/route.js tests/integration/notes-reorder-api.test.js
git commit -m "feat(notes): add reorder API for drag-and-drop with tests"
```

---

## Task 7: i18n Translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh-TW.json`

- [ ] **Step 1: Add English translations**

Add to `messages/en.json` — insert `nav.notes` key and new `notes` namespace:

In the `"nav"` object, add after `"all": "All"`:
```json
"notes": "Notes"
```

Add new top-level `"notes"` namespace:
```json
"notes": {
  "title": "Notes",
  "newPage": "New Page",
  "untitled": "Untitled",
  "delete": "Delete",
  "rename": "Rename",
  "addSubPage": "Add sub-page",
  "duplicate": "Duplicate",
  "emptyState": "No notes yet. Create your first page!",
  "emptyStateAction": "New Page",
  "aiCommand": "AI Command",
  "aiGenerated": "AI generated",
  "autoSaved": "Auto-saved",
  "saving": "Saving...",
  "deleteFailed": "Failed to delete note",
  "saveFailed": "Failed to save note",
  "confirmDelete": "Are you sure you want to delete this page and all its sub-pages?",
  "pageTree": "Page tree",
  "closeSidebar": "Close sidebar",
  "openSidebar": "Open sidebar"
}
```

- [ ] **Step 2: Add Chinese translations**

Add to `messages/zh-TW.json` — same structure:

In the `"nav"` object, add after `"all": "全部"`:
```json
"notes": "筆記"
```

Add new top-level `"notes"` namespace:
```json
"notes": {
  "title": "筆記",
  "newPage": "新增頁面",
  "untitled": "無標題",
  "delete": "刪除",
  "rename": "重新命名",
  "addSubPage": "新增子頁面",
  "duplicate": "複製",
  "emptyState": "還沒有筆記，建立你的第一個頁面！",
  "emptyStateAction": "新增頁面",
  "aiCommand": "AI 指令",
  "aiGenerated": "AI 生成",
  "autoSaved": "已自動儲存",
  "saving": "儲存中...",
  "deleteFailed": "刪除筆記失敗",
  "saveFailed": "儲存筆記失敗",
  "confirmDelete": "確定要刪除這個頁面及其所有子頁面嗎？",
  "pageTree": "頁面樹",
  "closeSidebar": "關閉側邊欄",
  "openSidebar": "開啟側邊欄"
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh-TW.json
git commit -m "feat(notes): add i18n translations for notes system"
```

---

## Task 8: Auth Middleware — Protect /notes

**Files:**
- Modify: `auth.config.js:35-39`

- [ ] **Step 1: Add /notes to protected routes**

In `auth.config.js`, update the `isOnProtectedRoute` check to include `/notes`:

```js
// Before (line 35-39):
const isOnProtectedRoute =
  pathname.startsWith("/reminders") ||
  pathname.startsWith("/dashboard") ||
  pathname.startsWith("/inbox") ||
  pathname.startsWith("/calendar");

// After:
const isOnProtectedRoute =
  pathname.startsWith("/reminders") ||
  pathname.startsWith("/dashboard") ||
  pathname.startsWith("/inbox") ||
  pathname.startsWith("/calendar") ||
  pathname.startsWith("/notes");
```

- [ ] **Step 2: Commit**

```bash
git add auth.config.js
git commit -m "feat(notes): protect /notes routes with auth middleware"
```

---

## Task 9: Navbar — Add Notes Link

**Files:**
- Modify: `components/layout/Navbar.js`

- [ ] **Step 1: Add FaStickyNote import and Notes link**

Add `FaStickyNote` to the react-icons import (line 18):
```js
import {
  FaBell, FaUser, FaSignOutAlt, FaMoon, FaSun,
  FaHome, FaInbox, FaCalendarAlt, FaList, FaGlobe,
  FaStickyNote,
} from "react-icons/fa";
```

Add the Notes link after the "All" link (after line 112, before `<GlobalSearch />`):
```jsx
<Link
  href="/notes"
  className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center gap-1.5"
>
  <FaStickyNote className="w-4 h-4" />
  <span className="hidden sm:inline">{t("notes")}</span>
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/Navbar.js
git commit -m "feat(notes): add Notes link to navbar"
```

---

## Task 10: Notes Layout Override + CSS

**Files:**
- Create: `app/[locale]/(app)/notes/layout.js`
- Modify: `app/globals.css`

- [ ] **Step 1: Create notes-specific layout**

```js
// app/[locale]/(app)/notes/layout.js
export default function NotesLayout({ children }) {
  return (
    <div className="h-[calc(100dvh-4rem)]">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add notes CSS to globals.css**

Append to `app/globals.css` after the existing cmdk/markdown styles:

```css
/* ── Notes System ── */

.notes-sidebar {
  width: 240px;
  min-width: 240px;
  border-right: 1px solid var(--border);
  background: var(--background-secondary);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.notes-tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard),
              color var(--duration-fast) var(--ease-standard);
  min-height: 32px;
  user-select: none;
}

.notes-tree-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.notes-tree-item[data-active="true"] {
  background: var(--surface-active);
  color: var(--text-primary);
  font-weight: 500;
}

.notes-tree-item[data-dragging="true"] {
  opacity: 0.5;
}

.notes-command-block {
  border-left: 3px solid var(--accent);
  background: var(--accent-light);
  padding: 8px 12px;
  border-radius: 0 6px 6px 0;
  margin: 4px 0;
}

.notes-command-block .command-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 4px;
}

.notes-command-block .command-text {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  color: var(--text-primary);
}

.notes-response-block {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 12px;
  margin: 4px 0;
}

.notes-response-block .response-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
}

.notes-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 40;
}

.dark .notes-drawer-backdrop {
  background: rgba(0, 0, 0, 0.6);
}

@keyframes slideFromLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes slideToLeft {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

.notes-drawer-enter {
  animation: slideFromLeft var(--duration-slow) var(--ease-decelerate) both;
}

.notes-drawer-exit {
  animation: slideToLeft var(--duration-normal) var(--ease-accelerate) both;
}

.notes-title-input {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  padding: 0;
  line-height: 1.3;
}

.notes-title-input::placeholder {
  color: var(--text-muted);
}

.notes-save-status {
  font-size: 12px;
  color: var(--text-muted);
  transition: opacity var(--duration-fast) var(--ease-standard);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/notes/layout.js app/globals.css
git commit -m "feat(notes): add full-width layout and notes CSS"
```

---

## Task 11: Install BlockNote Dependencies

- [ ] **Step 1: Install BlockNote packages**

```bash
npm install @blocknote/core @blocknote/react @blocknote/mantine
```

- [ ] **Step 2: Verify installation**

Run: `npm ls @blocknote/core @blocknote/react @blocknote/mantine`
Expected: All three packages listed with resolved versions

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install BlockNote editor dependencies"
```

---

## Task 12: Notes Home Page

**Files:**
- Create: `app/[locale]/(app)/notes/page.js`

- [ ] **Step 1: Implement notes home page**

```jsx
// app/[locale]/(app)/notes/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FaStickyNote, FaPlus } from "react-icons/fa";

export default function NotesPage() {
  const t = useTranslations("notes");
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          router.replace(`/notes/${data.data[0].id}`);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="skeleton-line w-48 h-6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <FaStickyNote className="w-12 h-12" style={{ color: "var(--text-muted)" }} />
      <p style={{ color: "var(--text-muted)" }} className="text-base">
        {t("emptyState")}
      </p>
      <button
        onClick={async () => {
          const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: t("untitled") }),
          });
          const data = await res.json();
          if (data.success) {
            router.push(`/notes/${data.data.id}`);
          }
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: "var(--primary)", color: "var(--text-inverted)" }}
      >
        <FaPlus className="w-3 h-3" />
        {t("emptyStateAction")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(app)/notes/page.js
git commit -m "feat(notes): add notes home page with empty state and redirect"
```

---

## Task 13: PageTree + PageTreeItem Components

**Files:**
- Create: `components/notes/PageTree.js`
- Create: `components/notes/PageTreeItem.js`

- [ ] **Step 1: Implement PageTreeItem**

```jsx
// components/notes/PageTreeItem.js
"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FaChevronRight, FaEllipsisH, FaPlus, FaTrash } from "react-icons/fa";
import useClickOutside from "@/hooks/useClickOutside";

export default function PageTreeItem({ note, depth = 0, activeNoteId, onCreateSubPage, onDeleteNote }) {
  const t = useTranslations("notes");
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useClickOutside(menuRef, () => setMenuOpen(false));

  const hasChildren = note.children && note.children.length > 0;
  const isActive = note.id === activeNoteId;

  return (
    <div>
      <div
        className="notes-tree-item group"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        data-active={isActive}
      >
        {/* Expand/collapse */}
        <button
          onClick={(e) => { e.preventDefault(); setExpanded((prev) => !prev); }}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded"
          style={{ color: "var(--text-muted)", visibility: hasChildren ? "visible" : "hidden" }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <FaChevronRight
            className="w-2.5 h-2.5 transition-transform"
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}
          />
        </button>

        <span className="flex-shrink-0 text-sm">{note.icon || "📄"}</span>

        <Link href={`/notes/${note.id}`} className="flex-1 truncate text-[13px]" title={note.title}>
          {note.title || t("untitled")}
        </Link>

        {/* Context menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen((prev) => !prev); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
            style={{ color: "var(--text-muted)" }}
            aria-label="Actions"
          >
            <FaEllipsisH className="w-3 h-3" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-20 min-w-[160px]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => { setMenuOpen(false); onCreateSubPage?.(note.id); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FaPlus className="w-3 h-3" /> {t("addSubPage")}
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDeleteNote?.(note.id); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--danger)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FaTrash className="w-3 h-3" /> {t("delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {note.children.map((child) => (
            <PageTreeItem
              key={child.id}
              note={child}
              depth={depth + 1}
              activeNoteId={activeNoteId}
              onCreateSubPage={onCreateSubPage}
              onDeleteNote={onDeleteNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement PageTree**

```jsx
// components/notes/PageTree.js
"use client";

import { useTranslations } from "next-intl";
import { FaPlus } from "react-icons/fa";
import { buildTree } from "@/lib/notes/tree";
import PageTreeItem from "./PageTreeItem";

export default function PageTree({ notes, activeNoteId, onCreateNote, onDeleteNote }) {
  const t = useTranslations("notes");
  const tree = buildTree(notes);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {t("title")}
        </span>
        <button
          onClick={() => onCreateNote?.()}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          aria-label={t("newPage")}
          title={t("newPage")}
        >
          <FaPlus className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {tree.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("emptyState")}</p>
          </div>
        ) : (
          tree.map((note) => (
            <PageTreeItem
              key={note.id}
              note={note}
              activeNoteId={activeNoteId}
              onCreateSubPage={(parentId) => onCreateNote?.(parentId)}
              onDeleteNote={onDeleteNote}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/notes/PageTree.js components/notes/PageTreeItem.js
git commit -m "feat(notes): add page tree sidebar with nested items and context menu"
```

---

## Task 14: NotesLayout + MobileSidebar Components

**Files:**
- Create: `components/notes/NotesLayout.js`
- Create: `components/notes/MobileSidebar.js`

- [ ] **Step 1: Implement NotesLayout**

```jsx
// components/notes/NotesLayout.js
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FaBars } from "react-icons/fa";
import PageTree from "./PageTree";
import MobileSidebar from "./MobileSidebar";

export default function NotesLayout({ notes, activeNoteId, onCreateNote, onDeleteNote, onReorder, children }) {
  const t = useTranslations("notes");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-full">
      <aside className="notes-sidebar hidden md:flex flex-col">
        <PageTree
          notes={notes}
          activeNoteId={activeNoteId}
          onCreateNote={onCreateNote}
          onDeleteNote={onDeleteNote}
        />
      </aside>

      <button
        className="md:hidden fixed top-[4.5rem] left-4 z-30 p-2 rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={() => setDrawerOpen(true)}
        aria-label={t("openSidebar")}
      >
        <FaBars className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
      </button>

      <MobileSidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notes={notes}
        activeNoteId={activeNoteId}
        onCreateNote={onCreateNote}
        onDeleteNote={onDeleteNote}
      />

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Implement MobileSidebar**

```jsx
// components/notes/MobileSidebar.js
"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { FaTimes } from "react-icons/fa";
import PageTree from "./PageTree";

export default function MobileSidebar({ open, onClose, notes, activeNoteId, onCreateNote, onDeleteNote }) {
  const t = useTranslations("notes");

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && activeNoteId) onClose();
  }, [activeNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <>
      <div className="notes-drawer-backdrop md:hidden" onClick={onClose} aria-hidden="true" />
      <aside
        className="notes-drawer-enter fixed top-16 left-0 bottom-0 w-[280px] z-50 flex flex-col md:hidden"
        style={{ background: "var(--background-secondary)", borderRight: "1px solid var(--border)" }}
        role="dialog"
        aria-label={t("pageTree")}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t("title")}</span>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} aria-label={t("closeSidebar")}>
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PageTree notes={notes} activeNoteId={activeNoteId} onCreateNote={onCreateNote} onDeleteNote={onDeleteNote} />
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/notes/NotesLayout.js components/notes/MobileSidebar.js
git commit -m "feat(notes): add split-pane layout and mobile sidebar drawer"
```

---

## Task 15: NoteEditor with BlockNote

**Files:**
- Create: `components/notes/NoteEditor.js`

- [ ] **Step 1: Implement the BlockNote editor wrapper**

```jsx
// components/notes/NoteEditor.js
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/mantine/style.css";

export default function NoteEditor({ note, onSave }) {
  const t = useTranslations("notes");
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const saveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setSaveStatus(null);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useCreateBlockNote({
    initialContent: note?.content?.length > 0 ? note.content : undefined,
  });

  useEffect(() => {
    if (note?.content?.length > 0) {
      editor.replaceBlocks(editor.document, note.content);
    } else {
      editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContentChange = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const content = editor.document;
      setSaveStatus("saving");
      onSave?.({ content }).then(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
      });
    }, 1000);
  }, [editor, onSave]);

  const handleTitleChange = useCallback((newTitle) => {
    setTitle(newTitle);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      setSaveStatus("saving");
      onSave?.({ title: newTitle }).then(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
      });
    }, 1000);
  }, [onSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex justify-end mb-2 h-5">
        {saveStatus && (
          <span className="notes-save-status">
            {saveStatus === "saving" ? t("saving") : t("autoSaved")}
          </span>
        )}
      </div>

      <input
        className="notes-title-input mb-4"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder={t("untitled")}
        aria-label="Page title"
      />

      <BlockNoteView
        editor={editor}
        theme={theme === "dark" ? "dark" : "light"}
        onChange={handleContentChange}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/notes/NoteEditor.js
git commit -m "feat(notes): add BlockNote editor with auto-save and theme support"
```

---

## Task 16: Single Note Page (Wiring Everything)

**Files:**
- Create: `app/[locale]/(app)/notes/[noteId]/page.js`

- [ ] **Step 1: Implement the note view page**

```jsx
// app/[locale]/(app)/notes/[noteId]/page.js
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import NotesLayout from "@/components/notes/NotesLayout";
import NoteEditor from "@/components/notes/NoteEditor";

export default function NotePage() {
  const { noteId } = useParams();
  const router = useRouter();
  const t = useTranslations("notes");
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      if (data.success) setNotes(data.data);
    } catch { /* silent */ }
  }, []);

  const fetchCurrentNote = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      const data = await res.json();
      if (data.success) { setCurrentNote(data.data); }
      else { router.replace("/notes"); }
    } catch { router.replace("/notes"); }
    finally { setLoading(false); }
  }, [noteId, router]);

  useEffect(() => { fetchNotes(); fetchCurrentNote(); }, [fetchNotes, fetchCurrentNote]);

  const handleSave = useCallback(async (updates) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success && updates.title) {
        setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, title: updates.title } : n));
      }
    } catch { toast.error(t("saveFailed")); }
  }, [noteId, t]);

  const handleCreateNote = useCallback(async (parentId) => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t("untitled"), parentId: parentId || null }),
      });
      const data = await res.json();
      if (data.success) { await fetchNotes(); router.push(`/notes/${data.data.id}`); }
    } catch { toast.error(t("saveFailed")); }
  }, [fetchNotes, router, t]);

  const handleDeleteNote = useCallback(async (id) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await fetchNotes();
        if (id === noteId) router.replace("/notes");
      }
    } catch { toast.error(t("deleteFailed")); }
  }, [fetchNotes, noteId, router, t]);

  const handleReorder = useCallback(async (updates) => {
    try {
      await fetch("/api/notes/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      await fetchNotes();
    } catch { toast.error(t("saveFailed")); }
  }, [fetchNotes, t]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="skeleton-line w-48 h-6" /></div>;
  }

  return (
    <NotesLayout
      notes={notes}
      activeNoteId={noteId}
      onCreateNote={handleCreateNote}
      onDeleteNote={handleDeleteNote}
      onReorder={handleReorder}
    >
      {currentNote && <NoteEditor key={currentNote.id} note={currentNote} onSave={handleSave} />}
    </NotesLayout>
  );
}
```

- [ ] **Step 2: Verify end-to-end flow**

Run: dev server
Check:
1. `/notes` — empty state or redirect to first note
2. Create note — editor opens, title editable, content auto-saves
3. Page tree shows all notes in sidebar
4. Sub-page creation via context menu
5. Delete with cascade confirmation
6. Dark/light theme toggle — editor matches
7. Mobile (< 768px) — hamburger opens drawer

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/notes/[noteId]/page.js
git commit -m "feat(notes): add single note page wiring layout, editor, and tree"
```

---

## Task 17: Page Tree Drag-and-Drop

**Files:**
- Modify: `components/notes/PageTree.js`
- Modify: `components/notes/PageTreeItem.js`

- [ ] **Step 1: Add DnD to PageTree**

Replace `components/notes/PageTree.js` with:

```jsx
// components/notes/PageTree.js
"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { FaPlus } from "react-icons/fa";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDndSensors, computeSortOrders } from "@/lib/dnd";
import { buildTree } from "@/lib/notes/tree";
import PageTreeItem from "./PageTreeItem";

export default function PageTree({ notes, activeNoteId, onCreateNote, onDeleteNote, onReorder }) {
  const t = useTranslations("notes");
  const tree = buildTree(notes);
  const sensors = useDndSensors();
  const flatIds = notes.map((n) => n.id);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeNote = notes.find((n) => n.id === active.id);
    const overNote = notes.find((n) => n.id === over.id);
    if (!activeNote || !overNote) return;

    const targetParentId = overNote.parentId;
    const siblings = notes
      .filter((n) => n.parentId === targetParentId && n.id !== active.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const overIndex = siblings.findIndex((n) => n.id === over.id);
    siblings.splice(overIndex, 0, { ...activeNote, parentId: targetParentId });

    const updates = computeSortOrders(siblings).map((s) => ({
      ...s,
      parentId: targetParentId,
    }));

    onReorder?.(updates);
  }, [notes, onReorder]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {t("title")}
        </span>
        <button
          onClick={() => onCreateNote?.()}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          aria-label={t("newPage")} title={t("newPage")}
        >
          <FaPlus className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {tree.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("emptyState")}</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
              {tree.map((note) => (
                <PageTreeItem
                  key={note.id} note={note} activeNoteId={activeNoteId}
                  onCreateSubPage={(parentId) => onCreateNote?.(parentId)}
                  onDeleteNote={onDeleteNote}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Make PageTreeItem sortable**

Add to the top of `components/notes/PageTreeItem.js`:
```js
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

At the start of the component function, add:
```js
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
const sortableStyle = { transform: CSS.Transform.toString(transform), transition };
```

Wrap the outer `<div>` with sortable ref:
```jsx
<div ref={setNodeRef} style={sortableStyle} {...attributes}>
  <div
    className="notes-tree-item group"
    style={{ paddingLeft: `${8 + depth * 20}px` }}
    data-active={isActive}
    data-dragging={isDragging}
    {...listeners}
  >
```

And update the closing `</div>` structure to match the new nesting.

- [ ] **Step 3: Pass onReorder through NotesLayout to PageTree**

In `components/notes/NotesLayout.js`, pass `onReorder` to the `<PageTree>` components (both desktop and mobile):
```jsx
<PageTree
  notes={notes}
  activeNoteId={activeNoteId}
  onCreateNote={onCreateNote}
  onDeleteNote={onDeleteNote}
  onReorder={onReorder}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/notes/PageTree.js components/notes/PageTreeItem.js components/notes/NotesLayout.js
git commit -m "feat(notes): add drag-and-drop reorder to page tree"
```

---

## Task 18: AI Notes Agent API

**Files:**
- Create: `app/api/ai/notes-agent/route.js`

- [ ] **Step 1: Implement the streaming AI endpoint**

```js
// app/api/ai/notes-agent/route.js
import { streamText } from "ai";
import { getModel } from "@/lib/ai/provider.js";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getNotesSystemPrompt({ language, noteTitle, noteContext }) {
  const lang = language === "zh" ? "繁體中文" : "English";
  return `You are a helpful AI assistant embedded in a notes editor. Respond in ${lang}.

Current note: "${noteTitle || "Untitled"}"

Context from the note:
${noteContext || "(empty)"}

Instructions:
- For /ask: Answer the question clearly and concisely. Use the note context if relevant.
- For /summarize: Create a clear, structured summary of the provided content. Use headings and bullet points.
- For /digest: Generate a structured digest with: Key Points, Action Items, and Summary sections.

Format your response in Markdown. Be concise and useful.`;
}

export async function POST(request) {
  const session = await auth();

  if (!session?.user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { command, input, noteTitle, noteContext, language = "zh", model } = await request.json();

    if (!command) {
      return new Response(
        JSON.stringify({ success: false, error: "Command is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let userMessage;
    switch (command) {
      case "ask":
        userMessage = input || "Please help me.";
        break;
      case "summarize":
        userMessage = input ? `Summarize the following:\n\n${input}` : "Summarize the entire note content.";
        break;
      case "digest":
        userMessage = "Generate a structured digest of this note's content.";
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown command: ${command}` }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    const result = streamText({
      model: getModel(model),
      system: getNotesSystemPrompt({ language, noteTitle, noteContext }),
      messages: [{ role: "user", content: userMessage }],
      maxRetries: 2,
      onFinish: ({ usage }) => {
        console.log(JSON.stringify({
          event: "notes_agent_complete", command,
          inputTokens: usage?.promptTokens, outputTokens: usage?.completionTokens,
          timestamp: new Date().toISOString(),
        }));
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("POST /api/ai/notes-agent error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/ai/notes-agent/route.js
git commit -m "feat(notes): add streaming AI agent endpoint for inline commands"
```

---

## Task 19: AI Command/Response Blocks + Editor Integration

**Files:**
- Create: `components/notes/CommandBlock.js`
- Create: `components/notes/ResponseBlock.js`
- Modify: `components/notes/NoteEditor.js`

- [ ] **Step 1: Implement CommandBlock**

```jsx
// components/notes/CommandBlock.js
"use client";

import { useTranslations } from "next-intl";

export default function CommandBlock({ command, input }) {
  const t = useTranslations("notes");

  return (
    <div className="notes-command-block">
      <div className="command-label">{t("aiCommand")}</div>
      <div className="command-text">/{command} {input}</div>
    </div>
  );
}
```

- [ ] **Step 2: Implement ResponseBlock (using react-markdown for safe rendering)**

```jsx
// components/notes/ResponseBlock.js
"use client";

import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ResponseBlock({ content, loading }) {
  const t = useTranslations("notes");

  return (
    <div className="notes-response-block">
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton-line h-3 w-3/4" />
          <div className="skeleton-line h-3 w-1/2" />
          <div className="skeleton-line h-3 w-5/6" />
        </div>
      ) : (
        <>
          <div className="markdown-content text-sm" style={{ color: "var(--text-primary)" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
          <div className="response-label">{t("aiGenerated")}</div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add AI command execution to NoteEditor**

Add these imports to `components/notes/NoteEditor.js`:
```js
import { parseCommand } from "@/lib/notes/commands";
import CommandBlock from "./CommandBlock";
import ResponseBlock from "./ResponseBlock";
```

Add state after existing state:
```js
const [commandInput, setCommandInput] = useState("");
const [aiResponses, setAiResponses] = useState([]);
```

Add command handler:
```js
const handleCommand = useCallback(async () => {
  const parsed = parseCommand(commandInput);
  if (!parsed) return;

  const responseId = Date.now().toString();
  setAiResponses((prev) => [...prev, { id: responseId, ...parsed, content: "", loading: true }]);
  setCommandInput("");

  try {
    const blocks = editor.document;
    const noteContext = blocks
      .map((b) => b.content?.map((c) => c.text || "").join("") || "")
      .filter(Boolean).join("\n");

    const res = await fetch("/api/ai/notes-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: parsed.type, input: parsed.input || noteContext, noteTitle: title, noteContext }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      setAiResponses((prev) => prev.map((r) => r.id === responseId ? { ...r, content: accumulated } : r));
    }

    setAiResponses((prev) => prev.map((r) => r.id === responseId ? { ...r, loading: false } : r));
  } catch {
    setAiResponses((prev) => prev.map((r) =>
      r.id === responseId ? { ...r, content: "Error: Failed to get AI response.", loading: false } : r
    ));
  }
}, [commandInput, editor, title]);
```

Add to JSX after `<BlockNoteView>`:
```jsx
{aiResponses.map((r) => (
  <div key={r.id} className="mt-4">
    <CommandBlock command={r.command} input={r.input} />
    <ResponseBlock content={r.content} loading={r.loading} />
  </div>
))}

<div className="mt-6 flex gap-2">
  <input
    type="text"
    value={commandInput}
    onChange={(e) => setCommandInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter" && commandInput.startsWith("/")) {
        e.preventDefault();
        handleCommand();
      }
    }}
    placeholder="/ask, /summarize, /digest..."
    className="flex-1 px-3 py-2 rounded-lg text-sm"
    style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
  />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add components/notes/CommandBlock.js components/notes/ResponseBlock.js components/notes/NoteEditor.js
git commit -m "feat(notes): add AI inline commands with streaming responses"
```

---

## Task 20: MongoDB Indexes

**Files:**
- Create: `scripts/create-notes-indexes.js`
- Modify: `package.json`

- [ ] **Step 1: Create index script**

```js
// scripts/create-notes-indexes.js
import connectDB, { getDatabase } from "../lib/db.js";

async function createNotesIndexes() {
  await connectDB();
  const db = await getDatabase();
  const col = db.collection("notes");

  console.log("Creating notes indexes...");

  await col.createIndex(
    { userId: 1, parentId: 1, sortOrder: 1 },
    { name: "notes_user_parent_sort" },
  );

  await col.createIndex(
    { userId: 1, updatedAt: -1 },
    { name: "notes_user_updated" },
  );

  console.log("Notes indexes created successfully.");
  process.exit(0);
}

createNotesIndexes().catch((err) => {
  console.error("Failed to create indexes:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script to package.json**

In `package.json` `"scripts"`, add:
```json
"create-notes-indexes": "node scripts/create-notes-indexes.js"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/create-notes-indexes.js package.json
git commit -m "chore(notes): add MongoDB index creation script"
```

---

## Task 21: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All existing + new notes tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Fix any issues found, commit if needed**

```bash
git add -A
git commit -m "fix(notes): resolve build/lint/test issues"
```

---

## Summary

| Task | Component | Type | Parallelizable With |
|------|-----------|------|---------------------|
| 1 | Tree utilities | Pure logic + unit test | 2, 3 |
| 2 | Command parser | Pure logic + unit test | 1, 3 |
| 3 | DB helpers | Data layer | 1, 2 |
| 4 | List/Create API | Backend + integration test | — |
| 5 | Get/Update/Delete API | Backend + integration test | — |
| 6 | Reorder API | Backend + integration test | — |
| 7 | i18n translations | Config | 8, 9 |
| 8 | Auth middleware | Config | 7, 9 |
| 9 | Navbar link | UI | 7, 8 |
| 10 | Layout + CSS | UI + styling | 11 |
| 11 | BlockNote install | Dependency | 10 |
| 12 | Notes home page | UI | — |
| 13 | PageTree + Item | UI | — |
| 14 | NotesLayout + Mobile | UI | — |
| 15 | NoteEditor (BlockNote) | UI | — |
| 16 | Note page (wiring) | Integration | — |
| 17 | Page tree DnD | UI | 18 |
| 18 | AI agent API | Backend | 17 |
| 19 | AI blocks + editor | UI | — |
| 20 | MongoDB indexes | DevOps | 19 |
| 21 | Final verification | QA | — |
