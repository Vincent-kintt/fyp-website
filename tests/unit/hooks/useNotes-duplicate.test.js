/**
 * Tests for `executeDuplicateNote` (M2).
 *
 * Per CLAUDE.md, hooks that mix React state with side effects extract the
 * side-effect body to a top-level `execute*` async function with dependency
 * injection. This locks the client-side behavior:
 *
 * - Single POST /api/notes/[noteId]/duplicate — no chained GET/POST/PATCH.
 * - On success: invalidateAll then router.push to the new note.
 * - On error: toast.error("saveFailed") — no compensation.
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
// fine under Next/Turbopack but breaks in vitest's Node ESM resolver
// (createNavigation.js does `import { useRouter } from 'next/navigation'`
// at module load). Stub the navigation factory so the import chain
// resolves; the pure function under test takes `router` via DI anyway.
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
  Link: () => null,
}));

const { executeDuplicateNote } = await import("@/hooks/useNotes.js");

function makeToast() {
  const fn = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  fn.warning = vi.fn();
  return fn;
}

function makeT() {
  return vi.fn((key) => key);
}

describe("executeDuplicateNote — single POST to the duplicate endpoint", () => {
  it("calls POST /api/notes/[id]/duplicate exactly once", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { id: "new-id" } }),
      }),
    );
    const invalidateAll = vi.fn(() => Promise.resolve());
    const router = { push: vi.fn() };
    const toast = makeToast();
    const t = makeT();

    await executeDuplicateNote({
      id: "source-id",
      fetch,
      invalidateAll,
      router,
      toast,
      t,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/notes/source-id/duplicate", {
      method: "POST",
    });
  });

  it("does not call the legacy chained GET / POST /api/notes / PATCH", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { id: "new-id" } }),
      }),
    );
    const invalidateAll = vi.fn(() => Promise.resolve());
    const router = { push: vi.fn() };
    const toast = makeToast();
    const t = makeT();

    await executeDuplicateNote({
      id: "source-id",
      fetch,
      invalidateAll,
      router,
      toast,
      t,
    });

    const urls = fetch.mock.calls.map((c) => c[0]);
    expect(urls).not.toContain("/api/notes/source-id");
    expect(urls.some((u) => u === "/api/notes")).toBe(false);
    const methods = fetch.mock.calls.map((c) => c[1]?.method);
    expect(methods).not.toContain("PATCH");
    expect(methods).not.toContain("GET");
  });

  it("invalidates queries then navigates to the new note on success", async () => {
    const order = [];
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: { id: "new-id" } }),
      }),
    );
    const invalidateAll = vi.fn(() => {
      order.push("invalidateAll");
      return Promise.resolve();
    });
    const router = {
      push: vi.fn((path) => order.push(`push:${path}`)),
    };
    const toast = makeToast();
    const t = makeT();

    const result = await executeDuplicateNote({
      id: "source-id",
      fetch,
      invalidateAll,
      router,
      toast,
      t,
    });

    expect(invalidateAll).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/notes/new-id");
    expect(order).toEqual(["invalidateAll", "push:/notes/new-id"]);
    expect(result).toEqual({ id: "new-id" });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows saveFailed toast and does not navigate when the server returns success:false", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false, error: "boom" }),
      }),
    );
    const invalidateAll = vi.fn(() => Promise.resolve());
    const router = { push: vi.fn() };
    const toast = makeToast();
    const t = makeT();

    await executeDuplicateNote({
      id: "source-id",
      fetch,
      invalidateAll,
      router,
      toast,
      t,
    });

    expect(router.push).not.toHaveBeenCalled();
    expect(invalidateAll).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("saveFailed");
  });

  it("shows saveFailed toast when fetch throws", async () => {
    const fetch = vi.fn(() => Promise.reject(new Error("network")));
    const invalidateAll = vi.fn(() => Promise.resolve());
    const router = { push: vi.fn() };
    const toast = makeToast();
    const t = makeT();

    await executeDuplicateNote({
      id: "source-id",
      fetch,
      invalidateAll,
      router,
      toast,
      t,
    });

    expect(router.push).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("saveFailed");
  });
});
