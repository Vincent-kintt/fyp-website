/**
 * Tests for the `executeMaybeWakeSnoozed` top-level helper inside
 * hooks/useTasks.js. The helper is what replaces the previous per-task
 * `fetch().catch(console.error)` + permanent Set side effect. It must:
 *
 * - fire the bulk-wake mutation at most once per due cutoff within WAKE_BACKOFF_MS
 * - never fire while a wake is in-flight
 * - never fire when there are no past-due snoozed tasks
 * - tolerate invalid snoozedUntil values
 */

import { describe, it, expect, vi } from "vitest";

const { executeMaybeWakeSnoozed, WAKE_BACKOFF_MS } = await import(
  "@/hooks/useTasks.js"
);

function task(overrides = {}) {
  return {
    id: "t",
    status: "pending",
    snoozedUntil: null,
    ...overrides,
  };
}

function makeRef() {
  return { current: new Map() };
}

describe("WAKE_BACKOFF_MS", () => {
  it("is exported and is a positive finite number", () => {
    expect(typeof WAKE_BACKOFF_MS).toBe("number");
    expect(Number.isFinite(WAKE_BACKOFF_MS)).toBe(true);
    expect(WAKE_BACKOFF_MS).toBeGreaterThan(0);
  });
});

describe("executeMaybeWakeSnoozed", () => {
  it("returns false and does not fire when tasks is missing", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();

    const fired = executeMaybeWakeSnoozed({
      tasks: undefined,
      mutate,
      isPending: false,
      lastAttemptRef,
      now: new Date(),
    });

    expect(fired).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("returns false and does not fire when tasks is empty", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();

    const fired = executeMaybeWakeSnoozed({
      tasks: [],
      mutate,
      isPending: false,
      lastAttemptRef,
      now: new Date(),
    });

    expect(fired).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("returns false when all tasks are pending (no snoozed)", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();

    const fired = executeMaybeWakeSnoozed({
      tasks: [task({ id: "a" }), task({ id: "b" })],
      mutate,
      isPending: false,
      lastAttemptRef,
      now: new Date(),
    });

    expect(fired).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("returns false when a snoozed task is not yet due", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const now = new Date("2026-05-17T10:00:00.000Z");

    const fired = executeMaybeWakeSnoozed({
      tasks: [
        task({
          id: "s",
          status: "snoozed",
          snoozedUntil: "2026-05-17T11:00:00.000Z",
        }),
      ],
      mutate,
      isPending: false,
      lastAttemptRef,
      now,
    });

    expect(fired).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("fires mutate once when at least one snoozed task is past due", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const now = new Date("2026-05-17T10:00:00.000Z");

    const fired = executeMaybeWakeSnoozed({
      tasks: [
        task({
          id: "s",
          status: "snoozed",
          snoozedUntil: "2026-05-17T09:00:00.000Z",
        }),
      ],
      mutate,
      isPending: false,
      lastAttemptRef,
      now,
    });

    expect(fired).toBe(true);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("returns false when isPending is true, even if tasks are due", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const now = new Date("2026-05-17T10:00:00.000Z");

    const fired = executeMaybeWakeSnoozed({
      tasks: [
        task({
          id: "s",
          status: "snoozed",
          snoozedUntil: "2026-05-17T09:00:00.000Z",
        }),
      ],
      mutate,
      isPending: true,
      lastAttemptRef,
      now,
    });

    expect(fired).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("backoff: second call for same cutoff within WAKE_BACKOFF_MS does not fire", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const snoozedUntil = "2026-05-17T09:00:00.000Z";

    const tasks = [
      task({ id: "s", status: "snoozed", snoozedUntil }),
    ];

    const firedFirst = executeMaybeWakeSnoozed({
      tasks,
      mutate,
      isPending: false,
      lastAttemptRef,
      now: new Date("2026-05-17T10:00:00.000Z"),
    });

    const firedSecond = executeMaybeWakeSnoozed({
      tasks,
      mutate,
      isPending: false,
      lastAttemptRef,
      now: new Date("2026-05-17T10:00:01.000Z"),
    });

    expect(firedFirst).toBe(true);
    expect(firedSecond).toBe(false);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("backoff: after WAKE_BACKOFF_MS elapses, a same-cutoff call fires again", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const snoozedUntil = "2026-05-17T09:00:00.000Z";
    const tasks = [
      task({ id: "s", status: "snoozed", snoozedUntil }),
    ];

    const firstNow = new Date("2026-05-17T10:00:00.000Z");
    executeMaybeWakeSnoozed({
      tasks,
      mutate,
      isPending: false,
      lastAttemptRef,
      now: firstNow,
    });

    const secondNow = new Date(firstNow.getTime() + WAKE_BACKOFF_MS + 1);
    const fired = executeMaybeWakeSnoozed({
      tasks,
      mutate,
      isPending: false,
      lastAttemptRef,
      now: secondNow,
    });

    expect(fired).toBe(true);
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it("multiple due cutoffs: keys off the earliest, only fires once", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const now = new Date("2026-05-17T10:00:00.000Z");

    const fired = executeMaybeWakeSnoozed({
      tasks: [
        task({
          id: "a",
          status: "snoozed",
          snoozedUntil: "2026-05-17T09:30:00.000Z",
        }),
        task({
          id: "b",
          status: "snoozed",
          snoozedUntil: "2026-05-17T09:00:00.000Z",
        }),
        task({
          id: "c",
          status: "snoozed",
          snoozedUntil: "2026-05-17T09:45:00.000Z",
        }),
      ],
      mutate,
      isPending: false,
      lastAttemptRef,
      now,
    });

    expect(fired).toBe(true);
    expect(mutate).toHaveBeenCalledTimes(1);
    // Earliest due cutoff (09:00) is the backoff key
    expect(
      lastAttemptRef.current.has("2026-05-17T09:00:00.000Z"),
    ).toBe(true);
  });

  it("invalid snoozedUntil values are ignored, not fired on", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const now = new Date("2026-05-17T10:00:00.000Z");

    const fired = executeMaybeWakeSnoozed({
      tasks: [
        task({
          id: "bad",
          status: "snoozed",
          snoozedUntil: "not-a-real-date",
        }),
      ],
      mutate,
      isPending: false,
      lastAttemptRef,
      now,
    });

    expect(fired).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("snoozed task with falsy snoozedUntil is ignored", () => {
    const mutate = vi.fn();
    const lastAttemptRef = makeRef();
    const now = new Date("2026-05-17T10:00:00.000Z");

    const fired = executeMaybeWakeSnoozed({
      tasks: [
        task({ id: "s", status: "snoozed", snoozedUntil: null }),
        task({ id: "s2", status: "snoozed", snoozedUntil: undefined }),
      ],
      mutate,
      isPending: false,
      lastAttemptRef,
      now,
    });

    expect(fired).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });
});
