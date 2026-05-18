// Tests for hooks/useTaskEditFormSubmit.js — focuses on the pure
// `executeSubmit({...})` orchestrator. Per the executeDragEnd / executeQuickAdd
// pattern, the side-effecting body is exposed as a module-level async function
// with full dependency injection so we don't need React to test it.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeSubmit } from "@/hooks/useTaskEditFormSubmit.js";

function makeMutation(impl) {
  return { mutateAsync: vi.fn(impl) };
}

function makeToast() {
  return { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
}

function makeT() {
  return (key) => `T(${key})`;
}

const BASE_FORM = {
  title: "Buy milk",
  description: "",
  remark: "",
  dateTime: "2026-05-18T09:00",
  duration: null,
  status: "pending",
  category: "personal",
  tags: [],
  recurring: false,
  recurringType: "daily",
  priority: "medium",
  subtasks: [],
};

const REMINDER = { id: "r1", inboxState: "scheduled" };

let consoleErrorSpy;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("executeSubmit — validation", () => {
  it("sets error and returns when title is empty / whitespace, skipping mutation", async () => {
    const updateMutation = makeMutation();
    const onSave = vi.fn();
    const setError = vi.fn();
    const setIsSubmitting = vi.fn();

    const result = await executeSubmit({
      formData: { ...BASE_FORM, title: "   " },
      reminder: REMINDER,
      userTimezone: "Asia/Hong_Kong",
      updateMutation,
      t: makeT(),
      toast: makeToast(),
      onSave,
      setError,
      setIsSubmitting,
    });

    expect(result.ok).toBe(false);
    expect(setError).toHaveBeenCalledWith("T(titleRequired)");
    expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("sets dateRequired error when dateTime missing AND reminder is not inbox", async () => {
    const updateMutation = makeMutation();
    const setError = vi.fn();

    await executeSubmit({
      formData: { ...BASE_FORM, dateTime: "" },
      reminder: REMINDER,
      userTimezone: "Asia/Hong_Kong",
      updateMutation,
      t: makeT(),
      toast: makeToast(),
      onSave: vi.fn(),
      setError,
      setIsSubmitting: vi.fn(),
    });

    expect(setError).toHaveBeenCalledWith("T(dateRequired)");
    expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("allows submission without dateTime when reminder.inboxState === 'inbox'", async () => {
    const serverResp = { id: "r1", title: "Buy milk", inboxState: "inbox" };
    const updateMutation = makeMutation(async () => serverResp);
    const onSave = vi.fn();
    const setError = vi.fn();

    const result = await executeSubmit({
      formData: { ...BASE_FORM, dateTime: "" },
      reminder: { id: "r1", inboxState: "inbox" },
      userTimezone: "Asia/Hong_Kong",
      updateMutation,
      t: makeT(),
      toast: makeToast(),
      onSave,
      setError,
      setIsSubmitting: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(onSave).toHaveBeenCalledWith(serverResp);
    expect(updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
    // dateTime should be passed through as null (buildSubmitPayload converts
    // empty -> null per H7 helper).
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", dateTime: null }),
    );
  });
});

describe("executeSubmit — happy path", () => {
  it("calls onSave with the server response (canonical post-PUT reminder)", async () => {
    const serverResp = { id: "r1", title: "Buy milk", status: "completed" };
    const updateMutation = makeMutation(async () => serverResp);
    const onSave = vi.fn();
    const setIsSubmitting = vi.fn();

    const result = await executeSubmit({
      formData: BASE_FORM,
      reminder: REMINDER,
      userTimezone: "Asia/Hong_Kong",
      updateMutation,
      t: makeT(),
      toast: makeToast(),
      onSave,
      setError: vi.fn(),
      setIsSubmitting,
    });

    expect(result.ok).toBe(true);
    expect(result.data).toBe(serverResp);
    expect(onSave).toHaveBeenCalledWith(serverResp);
    expect(setIsSubmitting.mock.calls).toEqual([[true], [false]]);
  });
});

describe("executeSubmit — failure path", () => {
  it("calls toast.error and skips onSave when mutation rejects", async () => {
    const err = new Error("Network down");
    const updateMutation = makeMutation(async () => {
      throw err;
    });
    const onSave = vi.fn();
    const toast = makeToast();
    const setIsSubmitting = vi.fn();

    const result = await executeSubmit({
      formData: BASE_FORM,
      reminder: REMINDER,
      userTimezone: "Asia/Hong_Kong",
      updateMutation,
      t: makeT(),
      toast,
      onSave,
      setError: vi.fn(),
      setIsSubmitting,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(err);
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Network down");
    // Finally branch must run setIsSubmitting(false)
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("falls back to T(updateFailed) when error has no message", async () => {
    const updateMutation = makeMutation(async () => {
      throw { foo: "bar" };
    });
    const toast = makeToast();

    await executeSubmit({
      formData: BASE_FORM,
      reminder: REMINDER,
      userTimezone: "Asia/Hong_Kong",
      updateMutation,
      t: makeT(),
      toast,
      onSave: vi.fn(),
      setError: vi.fn(),
      setIsSubmitting: vi.fn(),
    });

    expect(toast.error).toHaveBeenCalledWith("T(updateFailed)");
  });
});
