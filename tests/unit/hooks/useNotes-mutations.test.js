/**
 * Tests for the M4 useNotes refactor: each note mutation extracted to a
 * pure async helper (executeCreateNote, executeRenameNote, executeDeleteNote,
 * executeRestoreNote, executePermanentDeleteNote) following the pattern of
 * executeDuplicateNote (M2) and executeDeleteTask/executeUndoTask from
 * useTasks.
 *
 * These helpers take all collaborators via DI so they can be tested without
 * rendering React. The hook surface (useNotes) wraps each one in a
 * useMutation to surface isPending; that aspect is verified by integration /
 * consumer behaviour, not here.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Module-load isolation: hooks/useNotes.js imports @/i18n/navigation which
// statically pulls next-intl/navigation -> next/navigation. That resolves
// fine under Next/Turbopack but breaks in vitest's Node ESM resolver. Stub
// so the import chain resolves; the pure functions under test take router
// via DI anyway.
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
  Link: () => null,
}));

const {
  executeCreateNote,
  executeRenameNote,
  executeDeleteNote,
  executeRestoreNote,
  executePermanentDeleteNote,
} = await import("@/hooks/useNotes.js");
const { noteKeys } = await import("@/lib/queryKeys.js");

function makeToast() {
  const fn = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  fn.warning = vi.fn();
  return fn;
}

function makeT(map = {}) {
  return vi.fn((key) => map[key] ?? key);
}

function makeNote(overrides = {}) {
  return {
    id: "n1",
    title: "Note 1",
    parentId: null,
    sortOrder: 1000,
    icon: null,
    deleted: false,
    updatedAt: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// executeCreateNote
// ---------------------------------------------------------------------------
describe("executeCreateNote — POST /api/notes then invalidate and navigate", () => {
  it("posts to /api/notes with the untitled title and the given parentId, then invalidates and navigates", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: { id: "new-id" } }),
      }),
    );
    const queryClient = { invalidateQueries: vi.fn(() => Promise.resolve()) };
    const router = { push: vi.fn() };
    const toast = makeToast();
    const t = makeT({ untitled: "Untitled" });

    const out = await executeCreateNote({
      parentId: "parent-id",
      fetch,
      queryClient,
      noteKeys,
      router,
      toast,
      t,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled", parentId: "parent-id" }),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.all,
    });
    expect(router.push).toHaveBeenCalledWith("/notes/new-id");
    expect(out).toEqual({ id: "new-id" });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("passes parentId: null when no parent is given", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: { id: "new-id" } }),
      }),
    );
    const queryClient = { invalidateQueries: vi.fn(() => Promise.resolve()) };
    const router = { push: vi.fn() };
    const toast = makeToast();
    const t = makeT({ untitled: "Untitled" });

    await executeCreateNote({
      parentId: undefined,
      fetch,
      queryClient,
      noteKeys,
      router,
      toast,
      t,
    });

    const [, opts] = fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({
      title: "Untitled",
      parentId: null,
    });
  });

  it("shows saveFailed toast when fetch throws (no rollback needed because no optimistic write)", async () => {
    const fetch = vi.fn(() => Promise.reject(new Error("network")));
    const queryClient = { invalidateQueries: vi.fn() };
    const router = { push: vi.fn() };
    const toast = makeToast();
    const t = makeT();

    await executeCreateNote({
      parentId: null,
      fetch,
      queryClient,
      noteKeys,
      router,
      toast,
      t,
    });

    expect(router.push).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("saveFailed");
  });
});

// ---------------------------------------------------------------------------
// executeRenameNote
// ---------------------------------------------------------------------------
describe("executeRenameNote — optimistic title update with rollback", () => {
  it("optimistically updates the title in noteKeys.lists() cache before fetch resolves", async () => {
    const previous = [makeNote({ id: "n1", title: "Old" }), makeNote({ id: "n2", title: "Other" })];
    const callLog = [];

    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn((...args) => {
        callLog.push({ name: "setQueryData", args });
      }),
      invalidateQueries: vi.fn(() => Promise.resolve()),
    };
    const fetch = vi.fn((...args) => {
      callLog.push({ name: "fetch", args });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
    const toast = makeToast();
    const t = makeT();

    await executeRenameNote({
      id: "n1",
      newTitle: "New",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    // Optimistic set precedes fetch.
    const setCall = callLog.find((c) => c.name === "setQueryData");
    const fetchCall = callLog.find((c) => c.name === "fetch");
    expect(callLog.indexOf(setCall)).toBeLessThan(callLog.indexOf(fetchCall));

    const [keyArg, updater] = setCall.args;
    expect(keyArg).toEqual(noteKeys.lists());
    const result = typeof updater === "function" ? updater(previous) : updater;
    expect(result.find((n) => n.id === "n1").title).toBe("New");
    expect(result.find((n) => n.id === "n2").title).toBe("Other");

    // PATCH issued with the title.
    expect(fetch).toHaveBeenCalledWith("/api/notes/n1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New" }),
    });

    // Invalidation on settled.
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.all,
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rolls back to the snapshot and shows saveFailed when fetch fails", async () => {
    const previous = [makeNote({ id: "n1", title: "Old" })];
    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(() => Promise.resolve()),
    };
    const fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const toast = makeToast();
    const t = makeT();

    await executeRenameNote({
      id: "n1",
      newTitle: "New",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    // First call: optimistic write. Second call: rollback to snapshot.
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(2);
    expect(queryClient.setQueryData.mock.calls[1][0]).toEqual(noteKeys.lists());
    expect(queryClient.setQueryData.mock.calls[1][1]).toBe(previous);
    expect(toast.error).toHaveBeenCalledWith("saveFailed");
  });
});

// ---------------------------------------------------------------------------
// executeDeleteNote
// ---------------------------------------------------------------------------
describe("executeDeleteNote — optimistic removal with rollback + cache cleanup", () => {
  it("optimistically filters the deleted note from the list, calls DELETE, removes detail cache, and returns true on success", async () => {
    const target = makeNote({ id: "n1" });
    const other = makeNote({ id: "n2" });
    const previous = [target, other];

    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn(),
      removeQueries: vi.fn(),
      invalidateQueries: vi.fn(() => Promise.resolve()),
    };
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }),
    );
    const toast = makeToast();
    const t = makeT();

    const ok = await executeDeleteNote({
      id: "n1",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    expect(ok).toBe(true);

    // Optimistic removal applied first.
    const [keyArg, updater] = queryClient.setQueryData.mock.calls[0];
    expect(keyArg).toEqual(noteKeys.lists());
    const newList = typeof updater === "function" ? updater(previous) : updater;
    expect(newList).toEqual([other]);

    // DELETE issued.
    expect(fetch).toHaveBeenCalledWith("/api/notes/n1", { method: "DELETE" });

    // Detail cache removed for the deleted id.
    expect(queryClient.removeQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.detail("n1"),
    });

    // Invalidation on settled.
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.all,
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rolls back to the snapshot, shows deleteFailed, and returns false when fetch fails", async () => {
    const target = makeNote({ id: "n1" });
    const previous = [target];

    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn(),
      removeQueries: vi.fn(),
      invalidateQueries: vi.fn(() => Promise.resolve()),
    };
    const fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const toast = makeToast();
    const t = makeT();

    const ok = await executeDeleteNote({
      id: "n1",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    expect(ok).toBe(false);
    // Optimistic write + rollback.
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(2);
    expect(queryClient.setQueryData.mock.calls[1][1]).toBe(previous);
    // Detail cache NOT removed on failure (the note still exists server-side).
    expect(queryClient.removeQueries).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("deleteFailed");
  });

  it("returns false and rolls back when fetch throws", async () => {
    const previous = [makeNote({ id: "n1" })];
    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn(),
      removeQueries: vi.fn(),
      invalidateQueries: vi.fn(() => Promise.resolve()),
    };
    const fetch = vi.fn(() => Promise.reject(new Error("network")));
    const toast = makeToast();
    const t = makeT();

    const ok = await executeDeleteNote({
      id: "n1",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    expect(ok).toBe(false);
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(2);
    expect(queryClient.setQueryData.mock.calls[1][1]).toBe(previous);
    expect(toast.error).toHaveBeenCalledWith("deleteFailed");
  });
});

// ---------------------------------------------------------------------------
// executeRestoreNote
// ---------------------------------------------------------------------------
describe("executeRestoreNote — POST to /restore with invalidation", () => {
  it("posts to /api/notes/[id]/restore and invalidates on success", async () => {
    const queryClient = {
      invalidateQueries: vi.fn(() => Promise.resolve()),
    };
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }),
    );
    const toast = makeToast();
    const t = makeT();

    await executeRestoreNote({
      id: "n1",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    expect(fetch).toHaveBeenCalledWith("/api/notes/n1/restore", {
      method: "POST",
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.all,
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows saveFailed when fetch fails", async () => {
    const queryClient = {
      invalidateQueries: vi.fn(() => Promise.resolve()),
    };
    const fetch = vi.fn(() => Promise.reject(new Error("network")));
    const toast = makeToast();
    const t = makeT();

    await executeRestoreNote({
      id: "n1",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    expect(toast.error).toHaveBeenCalledWith("saveFailed");
  });
});

// ---------------------------------------------------------------------------
// executePermanentDeleteNote
// ---------------------------------------------------------------------------
describe("executePermanentDeleteNote — DELETE then detail-cache cleanup", () => {
  it("calls DELETE /api/notes/[id], invalidates, and removes the detail cache on success", async () => {
    const queryClient = {
      invalidateQueries: vi.fn(() => Promise.resolve()),
      removeQueries: vi.fn(),
    };
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }),
    );
    const toast = makeToast();
    const t = makeT();

    await executePermanentDeleteNote({
      id: "n1",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    expect(fetch).toHaveBeenCalledWith("/api/notes/n1", { method: "DELETE" });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.all,
    });
    expect(queryClient.removeQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.detail("n1"),
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows deleteFailed and does not remove the cache when fetch fails", async () => {
    const queryClient = {
      invalidateQueries: vi.fn(() => Promise.resolve()),
      removeQueries: vi.fn(),
    };
    const fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const toast = makeToast();
    const t = makeT();

    await executePermanentDeleteNote({
      id: "n1",
      fetch,
      queryClient,
      noteKeys,
      toast,
      t,
    });

    expect(queryClient.removeQueries).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("deleteFailed");
  });
});
