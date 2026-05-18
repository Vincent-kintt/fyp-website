/**
 * Tests for `executeResetInbox` (M1).
 *
 * Per CLAUDE.md "Hooks that mix React state with side effects: extract the
 * side-effect body to a top-level `execute*` async function with dependency
 * injection; test that directly." Same shape as `executeDragEnd` and
 * `executeDeleteTask`.
 *
 * The behaviour under test:
 *
 *   1. Snapshot the previous inbox cache + caller-supplied extractedTasks /
 *      confirmedTasks BEFORE clearing — these are the rollback fixtures.
 *   2. Optimistically clear local state (setExtractedTasks([]),
 *      setConfirmedTasks([])) and the cache (content: []).
 *   3. Bump editorKey so the keyed editor remounts empty.
 *   4. Await `updateMutation.mutateAsync({ content: [], extractedTasks: [],
 *      confirmedTasks: [] })`.
 *   5a. On success: do nothing — the optimistic shape is the desired final
 *       shape; the hook's onSuccess invalidates.
 *   5b. On failure: restore local state to the captured snapshots, restore
 *       the cache to the captured cache snapshot, bump editorKey AGAIN so
 *       the editor remounts with the restored content, and call
 *       toast.error(t("resetFailed")).
 */

import { describe, it, expect, vi } from "vitest";

const { executeResetInbox } = await import(
  "@/lib/inbox/executeResetInbox.js"
);

function makeT() {
  return vi.fn((key) => key);
}

function makeToast() {
  const fn = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  fn.warning = vi.fn();
  return fn;
}

function makeQueryClient(initial) {
  const store = new Map();
  store.set(JSON.stringify(["inbox", "note"]), initial);
  return {
    getQueryData: vi.fn((key) => store.get(JSON.stringify(key))),
    setQueryData: vi.fn((key, updater) => {
      const prev = store.get(JSON.stringify(key));
      const next = typeof updater === "function" ? updater(prev) : updater;
      store.set(JSON.stringify(key), next);
      return next;
    }),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Success path — optimistic clear, no rollback, no error toast
// ---------------------------------------------------------------------------
describe("executeResetInbox — PATCH succeeds", () => {
  it("clears local state + cache, bumps editorKey once, and never restores or toasts on success", async () => {
    const initialCache = {
      id: "n1",
      content: [{ type: "paragraph", content: "hello" }],
      title: "Inbox",
    };
    const queryClient = makeQueryClient(initialCache);
    const currentExtractedTasks = [
      { title: "Reply to Bob", confirmed: false },
    ];
    const currentConfirmedTasks = ["Buy milk"];

    const setExtractedTasks = vi.fn();
    const setConfirmedTasks = vi.fn();
    const setEditorKey = vi.fn();
    const toast = makeToast();
    const t = makeT();

    const updateMutation = {
      mutateAsync: vi.fn(() => Promise.resolve({ success: true })),
    };

    await executeResetInbox({
      queryClient,
      updateMutation,
      setExtractedTasks,
      setConfirmedTasks,
      setEditorKey,
      toast,
      t,
      currentExtractedTasks,
      currentConfirmedTasks,
    });

    // Local state cleared.
    expect(setExtractedTasks).toHaveBeenCalledWith([]);
    expect(setConfirmedTasks).toHaveBeenCalledWith([]);

    // Cache cleared optimistically.
    const optimistic = queryClient._store.get(
      JSON.stringify(["inbox", "note"]),
    );
    expect(optimistic.content).toEqual([]);
    // Other fields preserved.
    expect(optimistic.id).toBe("n1");
    expect(optimistic.title).toBe("Inbox");

    // editorKey bumped exactly once (only optimistic remount; no rollback).
    expect(setEditorKey).toHaveBeenCalledTimes(1);

    // PATCH called with the expected body.
    expect(updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      content: [],
      extractedTasks: [],
      confirmedTasks: [],
    });

    // No rollback, no error toast.
    expect(toast.error).not.toHaveBeenCalled();
    expect(setExtractedTasks).toHaveBeenCalledTimes(1);
    expect(setConfirmedTasks).toHaveBeenCalledTimes(1);
  });

  it("captures the cache snapshot BEFORE the optimistic clear so rollback can restore it", async () => {
    const initialCache = {
      id: "n1",
      content: [{ type: "paragraph", content: "important draft" }],
    };
    const queryClient = makeQueryClient(initialCache);

    let cacheAtPatchTime = null;
    const updateMutation = {
      mutateAsync: vi.fn(() => {
        cacheAtPatchTime = queryClient._store.get(
          JSON.stringify(["inbox", "note"]),
        );
        return Promise.resolve({ success: true });
      }),
    };

    await executeResetInbox({
      queryClient,
      updateMutation,
      setExtractedTasks: vi.fn(),
      setConfirmedTasks: vi.fn(),
      setEditorKey: vi.fn(),
      toast: makeToast(),
      t: makeT(),
      currentExtractedTasks: [],
      currentConfirmedTasks: [],
    });

    // By the time PATCH fires, the cache has been cleared.
    expect(cacheAtPatchTime.content).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Failure path — full rollback + error toast + second editorKey bump
// ---------------------------------------------------------------------------
describe("executeResetInbox — PATCH fails", () => {
  it("restores local state, restores cache, bumps editorKey a second time, and surfaces resetFailed toast", async () => {
    const draftContent = [{ type: "paragraph", content: "important draft" }];
    const initialCache = {
      id: "n1",
      content: draftContent,
      title: "Inbox",
    };
    const queryClient = makeQueryClient(initialCache);
    const currentExtractedTasks = [
      { title: "Reply to Bob", confirmed: false },
    ];
    const currentConfirmedTasks = ["Buy milk"];

    const setExtractedTasks = vi.fn();
    const setConfirmedTasks = vi.fn();
    const setEditorKey = vi.fn();
    const toast = makeToast();
    const t = makeT();

    const updateMutation = {
      mutateAsync: vi.fn(() => Promise.reject(new Error("network"))),
    };

    await executeResetInbox({
      queryClient,
      updateMutation,
      setExtractedTasks,
      setConfirmedTasks,
      setEditorKey,
      toast,
      t,
      currentExtractedTasks,
      currentConfirmedTasks,
    });

    // Local state restored to the pre-clear snapshots.
    expect(setExtractedTasks).toHaveBeenCalledWith(currentExtractedTasks);
    expect(setConfirmedTasks).toHaveBeenCalledWith(currentConfirmedTasks);
    // setExtractedTasks called twice: clear then restore.
    expect(setExtractedTasks).toHaveBeenCalledTimes(2);
    expect(setConfirmedTasks).toHaveBeenCalledTimes(2);
    // First call was the optimistic clear.
    expect(setExtractedTasks.mock.calls[0][0]).toEqual([]);
    expect(setConfirmedTasks.mock.calls[0][0]).toEqual([]);
    // Second call restored the snapshot.
    expect(setExtractedTasks.mock.calls[1][0]).toBe(currentExtractedTasks);
    expect(setConfirmedTasks.mock.calls[1][0]).toBe(currentConfirmedTasks);

    // Cache restored to the captured pre-clear snapshot.
    const restored = queryClient._store.get(
      JSON.stringify(["inbox", "note"]),
    );
    expect(restored.content).toBe(draftContent);
    expect(restored.id).toBe("n1");
    expect(restored.title).toBe("Inbox");

    // editorKey bumped TWICE: once for the optimistic clear, once for the
    // rollback. The editor is keyed so just restoring the cache isn't
    // enough — the remount drives the re-render with the restored content.
    expect(setEditorKey).toHaveBeenCalledTimes(2);

    // Error toast surfaces the failure with the documented namespace.
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("resetFailed");
    // `t` was called with the matching key.
    expect(t).toHaveBeenCalledWith("resetFailed");
  });

  it("rolls back even when extractedTasks and confirmedTasks were already empty", async () => {
    // Edge case: user clicks Reset Inbox after already clearing tasks, but
    // the editor still has content. PATCH must still fire (parity), and
    // failure must still roll the cache back.
    const draftContent = [{ type: "paragraph", content: "draft" }];
    const initialCache = { id: "n1", content: draftContent };
    const queryClient = makeQueryClient(initialCache);

    const setExtractedTasks = vi.fn();
    const setConfirmedTasks = vi.fn();
    const setEditorKey = vi.fn();
    const toast = makeToast();
    const t = makeT();

    const updateMutation = {
      mutateAsync: vi.fn(() => Promise.reject(new Error("500"))),
    };

    await executeResetInbox({
      queryClient,
      updateMutation,
      setExtractedTasks,
      setConfirmedTasks,
      setEditorKey,
      toast,
      t,
      currentExtractedTasks: [],
      currentConfirmedTasks: [],
    });

    // PATCH was attempted even though local state was empty — running for
    // parity (the editor content is the real reset target).
    expect(updateMutation.mutateAsync).toHaveBeenCalledTimes(1);

    // Cache restored.
    const restored = queryClient._store.get(
      JSON.stringify(["inbox", "note"]),
    );
    expect(restored.content).toBe(draftContent);

    // Error toast still fires.
    expect(toast.error).toHaveBeenCalledWith("resetFailed");

    // Two editorKey bumps (optimistic remount + rollback remount).
    expect(setEditorKey).toHaveBeenCalledTimes(2);
  });

  it("does not blow up if the cache snapshot was null (cold load)", async () => {
    // If the user somehow triggers reset before the inbox query has resolved,
    // the cache is undefined. Optimistic update leaves it as is; rollback is
    // a no-op for the cache. Local state rollback still applies.
    const queryClient = makeQueryClient(undefined);

    const setExtractedTasks = vi.fn();
    const setConfirmedTasks = vi.fn();
    const setEditorKey = vi.fn();
    const toast = makeToast();
    const t = makeT();

    const updateMutation = {
      mutateAsync: vi.fn(() => Promise.reject(new Error("500"))),
    };

    await executeResetInbox({
      queryClient,
      updateMutation,
      setExtractedTasks,
      setConfirmedTasks,
      setEditorKey,
      toast,
      t,
      currentExtractedTasks: [{ title: "Reply" }],
      currentConfirmedTasks: ["Buy milk"],
    });

    // Local state still rolls back.
    expect(setExtractedTasks).toHaveBeenLastCalledWith([{ title: "Reply" }]);
    expect(setConfirmedTasks).toHaveBeenLastCalledWith(["Buy milk"]);
    // Error toast still fires.
    expect(toast.error).toHaveBeenCalledWith("resetFailed");
  });
});

// ---------------------------------------------------------------------------
// Call ordering — optimistic clear must precede the PATCH, restore must
// follow it (not interleave).
// ---------------------------------------------------------------------------
describe("executeResetInbox — call ordering", () => {
  it("optimistic clear precedes PATCH; on failure, restore follows PATCH", async () => {
    const draftContent = [{ type: "paragraph", content: "draft" }];
    const initialCache = { id: "n1", content: draftContent };
    const queryClient = makeQueryClient(initialCache);

    const callLog = [];
    const setExtractedTasks = vi.fn((v) =>
      callLog.push({ name: "setExtractedTasks", value: v }),
    );
    const setConfirmedTasks = vi.fn((v) =>
      callLog.push({ name: "setConfirmedTasks", value: v }),
    );
    const setEditorKey = vi.fn(() => callLog.push({ name: "setEditorKey" }));
    queryClient.setQueryData = vi.fn((key, updater) => {
      const prev = queryClient._store.get(JSON.stringify(key));
      const next = typeof updater === "function" ? updater(prev) : updater;
      queryClient._store.set(JSON.stringify(key), next);
      callLog.push({
        name: "setQueryData",
        clearedTo: next?.content,
      });
      return next;
    });
    const toast = makeToast();
    toast.error = vi.fn(() => callLog.push({ name: "toast.error" }));
    const t = makeT();

    const updateMutation = {
      mutateAsync: vi.fn(() => {
        callLog.push({ name: "mutateAsync" });
        return Promise.reject(new Error("network"));
      }),
    };

    await executeResetInbox({
      queryClient,
      updateMutation,
      setExtractedTasks,
      setConfirmedTasks,
      setEditorKey,
      toast,
      t,
      currentExtractedTasks: [{ title: "Reply" }],
      currentConfirmedTasks: ["Buy milk"],
    });

    const names = callLog.map((c) => c.name);
    const idxClearExt = names.indexOf("setExtractedTasks");
    const idxMutate = names.indexOf("mutateAsync");
    const idxToast = names.indexOf("toast.error");

    expect(idxClearExt).toBeLessThan(idxMutate);
    expect(idxMutate).toBeLessThan(idxToast);
  });
});
