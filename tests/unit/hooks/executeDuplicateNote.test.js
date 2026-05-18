/**
 * Tests for the success-toast behavior of `executeDuplicateNote`.
 *
 * Companion to `useNotes-duplicate.test.js` (which locks the single-POST
 * shape). This file covers the new `copiedCount`-driven toast branch added
 * when subtree-duplicate landed: count === 1 → noteDuplicated; count > 1 →
 * notesDuplicatedCount with interpolation.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}));

// See useNotes-duplicate.test.js — stub the navigation factory so the import
// chain resolves under vitest's Node ESM resolver.
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
  Link: () => null,
}));

const { executeDuplicateNote } = await import("@/hooks/useNotes.js");

function makeDeps() {
  const fetch = vi.fn();
  const invalidateAll = vi.fn().mockResolvedValue();
  const router = { push: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };
  const t = vi.fn((key, opts) =>
    opts ? `${key}:${JSON.stringify(opts)}` : key,
  );
  return { fetch, invalidateAll, router, toast, t };
}

describe("executeDuplicateNote", () => {
  it("toasts noteDuplicated when copiedCount is 1", async () => {
    const deps = makeDeps();
    deps.fetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: { id: "new-id", copiedCount: 1 },
      }),
    });

    const result = await executeDuplicateNote({ id: "src", ...deps });

    expect(deps.invalidateAll).toHaveBeenCalledOnce();
    expect(deps.router.push).toHaveBeenCalledWith("/notes/new-id");
    expect(deps.toast.success).toHaveBeenCalledWith("noteDuplicated");
    expect(deps.toast.error).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "new-id", copiedCount: 1 });
  });

  it("toasts notesDuplicatedCount with count interpolation when copiedCount > 1", async () => {
    const deps = makeDeps();
    deps.fetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: { id: "new-id", copiedCount: 5 },
      }),
    });

    await executeDuplicateNote({ id: "src", ...deps });

    expect(deps.toast.success).toHaveBeenCalledWith(
      'notesDuplicatedCount:{"count":5}',
    );
  });

  it("toasts saveFailed when server returns success:false", async () => {
    const deps = makeDeps();
    deps.fetch.mockResolvedValue({
      json: async () => ({ success: false, error: "boom" }),
    });

    await executeDuplicateNote({ id: "src", ...deps });

    expect(deps.toast.error).toHaveBeenCalledWith("saveFailed");
    expect(deps.toast.success).not.toHaveBeenCalled();
    expect(deps.router.push).not.toHaveBeenCalled();
  });

  it("toasts saveFailed when fetch throws", async () => {
    const deps = makeDeps();
    deps.fetch.mockRejectedValue(new Error("network"));

    await executeDuplicateNote({ id: "src", ...deps });

    expect(deps.toast.error).toHaveBeenCalledWith("saveFailed");
    expect(deps.toast.success).not.toHaveBeenCalled();
  });
});
