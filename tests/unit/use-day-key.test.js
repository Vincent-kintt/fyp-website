/**
 * Tests for useDayKey hook and its supporting pure helpers.
 *
 * useDayKey uses useSyncExternalStore. The React hook itself requires a renderer
 * to test, which the repo intentionally avoids (no @testing-library/react). We test:
 *   1. Pure helpers (currentDayKey, msUntilNextMidnight) directly.
 *   2. Module-level store behaviour via _internals.subscribe / getSnapshot — this
 *      is the exact code useSyncExternalStore drives, so it exercises the full
 *      subscribe/notify/refresh contract without needing React.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  msUntilNextMidnight,
  currentDayKey,
  _internals,
} from "@/hooks/useDayKey.js";

describe("currentDayKey", () => {
  it("formats YYYY-MM-DD in local time", () => {
    const d = new Date(2026, 4, 16, 10, 0, 0); // May 16 2026 local
    expect(currentDayKey(d)).toBe("2026-05-16");
  });

  it("pads single-digit month and day", () => {
    const d = new Date(2026, 0, 5, 12, 0, 0); // Jan 5 2026 local
    expect(currentDayKey(d)).toBe("2026-01-05");
  });

  it("uses local date (not UTC) at end of day", () => {
    const d = new Date(2026, 4, 16, 23, 59, 59);
    expect(currentDayKey(d)).toBe("2026-05-16");
  });

  it("rolls forward at start of next day", () => {
    const d = new Date(2026, 4, 17, 0, 0, 0);
    expect(currentDayKey(d)).toBe("2026-05-17");
  });
});

describe("msUntilNextMidnight", () => {
  // Pure on `from` — local-time arithmetic.

  it("returns 14h + 100ms for local 10:00:00.000", () => {
    const from = new Date(2026, 4, 16, 10, 0, 0, 0);
    const expected = 14 * 60 * 60 * 1000 + 100;
    expect(msUntilNextMidnight(from)).toBe(expected);
  });

  it("returns 1100ms for local 23:59:59.000", () => {
    const from = new Date(2026, 4, 16, 23, 59, 59, 0);
    expect(msUntilNextMidnight(from)).toBe(1100);
  });

  it("returns a full 24h + 100ms for exactly local midnight (setHours(24,...) rolls forward)", () => {
    const from = new Date(2026, 4, 16, 0, 0, 0, 0);
    expect(msUntilNextMidnight(from)).toBe(24 * 60 * 60 * 1000 + 100);
  });

  it("is always positive across the day", () => {
    const times = [
      new Date(2026, 4, 16, 0, 0, 0, 1),
      new Date(2026, 4, 16, 6, 0, 0, 0),
      new Date(2026, 4, 16, 12, 0, 0, 0),
      new Date(2026, 4, 16, 18, 0, 0, 0),
      new Date(2026, 4, 16, 23, 59, 59, 999),
    ];
    for (const t of times) {
      expect(msUntilNextMidnight(t)).toBeGreaterThan(0);
    }
  });
});

describe("useDayKey store contract (via _internals)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 16, 23, 59, 59, 0));
    _internals.reset();
  });

  afterEach(() => {
    _internals.reset();
    vi.useRealTimers();
  });

  it("getSnapshot returns current day key", () => {
    expect(_internals.getSnapshot()).toBe("2026-05-16");
  });

  it("subscribe arms a midnight timer; firing it notifies listener and advances the day key", () => {
    const cb = vi.fn();
    const unsub = _internals.subscribe(cb);

    expect(_internals.getListenerCount()).toBe(1);
    expect(_internals.getTimerId()).not.toBeNull();
    expect(_internals.getSnapshot()).toBe("2026-05-16");
    expect(cb).not.toHaveBeenCalled();

    // Advance past midnight + buffer (1100ms from 23:59:59.000)
    vi.advanceTimersByTime(1100);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(_internals.getSnapshot()).toBe("2026-05-17");

    unsub();
  });

  it("unsubscribing the last listener clears the timer", () => {
    const cb = vi.fn();
    const unsub = _internals.subscribe(cb);
    expect(_internals.getTimerId()).not.toBeNull();

    unsub();

    expect(_internals.getListenerCount()).toBe(0);
    expect(_internals.getTimerId()).toBeNull();

    vi.advanceTimersByTime(10 * 60 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("midnight tick reschedules itself for the following day while listeners remain", () => {
    const cb = vi.fn();
    const unsub = _internals.subscribe(cb);

    // Day 1 → Day 2
    vi.advanceTimersByTime(1100);
    expect(_internals.getSnapshot()).toBe("2026-05-17");
    expect(cb).toHaveBeenCalledTimes(1);

    // Day 2 → Day 3 (advance another 24h + buffer)
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 100);
    expect(_internals.getSnapshot()).toBe("2026-05-18");
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
  });

  it("subscribing while sleep-wake gap pushed past midnight refreshes the cached key immediately", () => {
    // Simulate: a listener was around, then the tab slept; on wake we set system time
    // forward by a full day before the next subscribe call. The new subscriber should
    // see the fresh key, and existing listeners (if any) should be notified.
    const earlyCb = vi.fn();
    const unsubEarly = _internals.subscribe(earlyCb);
    expect(_internals.getSnapshot()).toBe("2026-05-16");

    // Tab is "asleep": jump system time past midnight without firing the timer.
    vi.setSystemTime(new Date(2026, 4, 17, 8, 0, 0));

    // A new subscribe (e.g. another dashboard component mounting) — should detect the gap.
    const lateCb = vi.fn();
    const unsubLate = _internals.subscribe(lateCb);

    expect(_internals.getSnapshot()).toBe("2026-05-17");
    expect(earlyCb).toHaveBeenCalledTimes(1); // earlier listener notified of the catch-up
    expect(lateCb).toHaveBeenCalledTimes(1); // and so is the new one (refresh fires before its add… actually after)

    unsubEarly();
    unsubLate();
  });

  it("multiple subscribers share one timer", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = _internals.subscribe(cb1);
    const timerAfterFirst = _internals.getTimerId();
    const unsub2 = _internals.subscribe(cb2);
    const timerAfterSecond = _internals.getTimerId();

    expect(_internals.getListenerCount()).toBe(2);
    expect(timerAfterSecond).toBe(timerAfterFirst);

    vi.advanceTimersByTime(1100);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);

    unsub1();
    expect(_internals.getTimerId()).not.toBeNull(); // cb2 still subscribed
    unsub2();
    expect(_internals.getTimerId()).toBeNull();
  });
});
