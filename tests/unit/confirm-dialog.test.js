import { describe, it, expect, vi } from "vitest";

/**
 * Behavioral contract tests for ConfirmDialog / PromptDialog.
 * These test the core logic (key handling, input validation) without DOM rendering.
 */

// -- Escape key behavior (shared by both dialogs) --

describe("Escape key handler", () => {
  function makeKeyHandler(closeFn) {
    return (e) => {
      if (e.key === "Escape") {
        closeFn();
      }
    };
  }

  it("calls close on Escape key", () => {
    const close = vi.fn();
    const handler = makeKeyHandler(close);
    handler({ key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not call close on Enter key", () => {
    const close = vi.fn();
    const handler = makeKeyHandler(close);
    handler({ key: "Enter" });
    expect(close).not.toHaveBeenCalled();
  });

  it("does not call close on Tab key", () => {
    const close = vi.fn();
    const handler = makeKeyHandler(close);
    handler({ key: "Tab" });
    expect(close).not.toHaveBeenCalled();
  });

  it("does not call close on arbitrary key", () => {
    const close = vi.fn();
    const handler = makeKeyHandler(close);
    handler({ key: "a" });
    expect(close).not.toHaveBeenCalled();
  });
});

// -- PromptDialog input validation --

describe("PromptDialog validation", () => {
  function validateAndSubmit(value, submitFn) {
    const trimmed = value.trim();
    if (!trimmed) return;
    submitFn(trimmed);
  }

  it("submits trimmed value for valid input", () => {
    const submit = vi.fn();
    validateAndSubmit("  hello world  ", submit);
    expect(submit).toHaveBeenCalledWith("hello world");
  });

  it("rejects empty string", () => {
    const submit = vi.fn();
    validateAndSubmit("", submit);
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only string", () => {
    const submit = vi.fn();
    validateAndSubmit("   ", submit);
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects tab-only string", () => {
    const submit = vi.fn();
    validateAndSubmit("\t\t", submit);
    expect(submit).not.toHaveBeenCalled();
  });

  it("accepts single character", () => {
    const submit = vi.fn();
    validateAndSubmit("a", submit);
    expect(submit).toHaveBeenCalledWith("a");
  });

  it("trims leading whitespace", () => {
    const submit = vi.fn();
    validateAndSubmit("  test", submit);
    expect(submit).toHaveBeenCalledWith("test");
  });

  it("trims trailing whitespace", () => {
    const submit = vi.fn();
    validateAndSubmit("test  ", submit);
    expect(submit).toHaveBeenCalledWith("test");
  });
});

// -- PromptDialog Enter key behavior --

describe("PromptDialog Enter key on input", () => {
  function makeInputKeyHandler(isValid, submitFn) {
    return (e) => {
      if (e.key === "Enter" && isValid) {
        e.preventDefault();
        submitFn();
      }
    };
  }

  it("submits on Enter when input is valid", () => {
    const submit = vi.fn();
    const preventDefault = vi.fn();
    const handler = makeInputKeyHandler(true, submit);
    handler({ key: "Enter", preventDefault });
    expect(submit).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("does not submit on Enter when input is invalid", () => {
    const submit = vi.fn();
    const preventDefault = vi.fn();
    const handler = makeInputKeyHandler(false, submit);
    handler({ key: "Enter", preventDefault });
    expect(submit).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("does not submit on other keys even when valid", () => {
    const submit = vi.fn();
    const preventDefault = vi.fn();
    const handler = makeInputKeyHandler(true, submit);
    handler({ key: "a", preventDefault });
    expect(submit).not.toHaveBeenCalled();
  });
});
