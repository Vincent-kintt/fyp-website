/**
 * Tests for `executeParse` — the module-level async helper that the
 * `useQuickAddParser` hook delegates to. Pure (modulo fetch + state
 * writer callbacks) so we test it directly without rendering React.
 *
 * Hook tests follow the executeDragEnd / executeQuickAdd DI pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { executeParse } = await import("@/hooks/useQuickAddParser.js");

function makeWriters() {
  return {
    setParsedData: vi.fn(),
    setIsParsing: vi.fn(),
    setShowEscalation: vi.fn(),
  };
}

function jsonResponse(body, { ok = true } = {}) {
  return {
    ok,
    json: () => Promise.resolve(body),
  };
}

describe("executeParse", () => {
  let consoleErrSpy;

  beforeEach(() => {
    consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrSpy.mockRestore();
  });

  it("returns null and clears parsedData for empty/short input", async () => {
    const writers = makeWriters();
    const fetchFn = vi.fn();

    const out = await executeParse({
      text: "",
      language: "en",
      fetchFn,
      writers,
      signal: new AbortController().signal,
    });

    expect(out).toBeNull();
    expect(writers.setParsedData).toHaveBeenCalledWith(null);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null for input shorter than 3 chars without fetching", async () => {
    const writers = makeWriters();
    const fetchFn = vi.fn();

    const out = await executeParse({
      text: "ab",
      language: "en",
      fetchFn,
      writers,
      signal: new AbortController().signal,
    });

    expect(out).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("on success: returns parsed data and writes parsedData", async () => {
    const data = { title: "Call mom", tags: ["family"] };
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse({ success: true, data })),
    );
    const writers = makeWriters();
    const controller = new AbortController();

    const out = await executeParse({
      text: "call mom tomorrow at 5pm",
      language: "en",
      fetchFn,
      writers,
      signal: controller.signal,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/ai/parse-task");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      text: "call mom tomorrow at 5pm",
      language: "en",
    });
    expect(init.signal).toBe(controller.signal);

    expect(out).toEqual(data);
    expect(writers.setIsParsing).toHaveBeenCalledWith(true);
    expect(writers.setParsedData).toHaveBeenCalledWith(data);
    expect(writers.setIsParsing).toHaveBeenLastCalledWith(false);
  });

  it("when result.success is false: returns null, does not write parsedData", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse({ success: false })),
    );
    const writers = makeWriters();
    const controller = new AbortController();

    const out = await executeParse({
      text: "call mom",
      language: "en",
      fetchFn,
      writers,
      signal: controller.signal,
    });

    expect(out).toBeNull();
    expect(writers.setParsedData).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.anything() }),
    );
    expect(writers.setIsParsing).toHaveBeenLastCalledWith(false);
  });

  it("when response is not ok: returns null and resets isParsing", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse({}, { ok: false })),
    );
    const writers = makeWriters();
    const controller = new AbortController();

    const out = await executeParse({
      text: "call mom",
      language: "en",
      fetchFn,
      writers,
      signal: controller.signal,
    });

    expect(out).toBeNull();
    expect(writers.setIsParsing).toHaveBeenLastCalledWith(false);
  });

  it("when aborted BEFORE fetch resolves: no parsedData write, no spinner reset", async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                jsonResponse({ success: true, data: { title: "late" } }),
              ),
            0,
          );
        }),
    );
    const writers = makeWriters();

    const pending = executeParse({
      text: "call mom",
      language: "en",
      fetchFn,
      writers,
      signal: controller.signal,
    });

    // Simulate the caller aborting before the fetch settles
    controller.abort();
    const out = await pending;

    expect(out).toBeNull();
    // Spinner reset is gated on !aborted; abort path skips it
    expect(writers.setIsParsing).not.toHaveBeenCalledWith(false);
    expect(writers.setParsedData).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "late" }),
    );
  });

  it("on AbortError thrown by fetch: returns null silently (no console.error)", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const fetchFn = vi.fn(() => Promise.reject(abortErr));
    const writers = makeWriters();
    const controller = new AbortController();
    // Caller marked the controller as aborted before the rejection surfaces
    controller.abort();

    const out = await executeParse({
      text: "call mom",
      language: "en",
      fetchFn,
      writers,
      signal: controller.signal,
    });

    expect(out).toBeNull();
    expect(consoleErrSpy).not.toHaveBeenCalled();
  });

  it("on non-abort fetch error: logs and returns null, resets isParsing", async () => {
    const err = new Error("network down");
    const fetchFn = vi.fn(() => Promise.reject(err));
    const writers = makeWriters();
    const controller = new AbortController();

    const out = await executeParse({
      text: "call mom",
      language: "en",
      fetchFn,
      writers,
      signal: controller.signal,
    });

    expect(out).toBeNull();
    expect(consoleErrSpy).toHaveBeenCalled();
    expect(writers.setIsParsing).toHaveBeenLastCalledWith(false);
  });

  it("passes language and current timezone in the request body", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse({ success: true, data: {} })),
    );
    const writers = makeWriters();
    const controller = new AbortController();

    await executeParse({
      text: "buy milk",
      language: "zh",
      fetchFn,
      writers,
      signal: controller.signal,
    });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.language).toBe("zh");
    expect(typeof body.timezone).toBe("string");
    expect(body.timezone.length).toBeGreaterThan(0);
  });
});
