/**
 * Tests for executeQuickAdd — pure async function with dependency injection.
 *
 * The hook useTasks composes useCreateReminder + toast policy. We extract the
 * compose body as a module-level helper so unit tests don't need React.
 */

import { describe, it, expect, vi } from "vitest";

const { executeQuickAdd } = await import("@/hooks/useTasks.js");

function makeT(map = {}) {
  return (key) => map[key] ?? key;
}

describe("executeQuickAdd", () => {
  it("invokes createReminder.mutateAsync with the payload and returns its result", async () => {
    const result = { success: true, data: { id: "r1", title: "X" } };
    const mutateAsync = vi.fn().mockResolvedValue(result);
    const toast = { success: vi.fn(), error: vi.fn() };
    const data = { title: "X" };

    const out = await executeQuickAdd({
      data,
      createReminder: { mutateAsync },
      t: makeT(),
      toast,
    });

    expect(mutateAsync).toHaveBeenCalledWith(data);
    expect(out).toBe(result);
  });

  it("calls toast.success with t('taskAdded') on success", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    const toast = { success: vi.fn(), error: vi.fn() };
    const t = makeT({ taskAdded: "Task added!" });

    await executeQuickAdd({
      data: { title: "X" },
      createReminder: { mutateAsync },
      t,
      toast,
    });

    expect(toast.success).toHaveBeenCalledWith("Task added!");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("calls toast.error with t('addFailed') and rethrows on failure", async () => {
    const err = new Error("Failed");
    const mutateAsync = vi.fn().mockRejectedValue(err);
    const toast = { success: vi.fn(), error: vi.fn() };
    const t = makeT({ addFailed: "Add failed" });

    await expect(
      executeQuickAdd({
        data: { title: "X" },
        createReminder: { mutateAsync },
        t,
        toast,
      }),
    ).rejects.toThrow("Failed");

    expect(toast.error).toHaveBeenCalledWith("Add failed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
