/**
 * Tests for executeMountConsistencyCheck (M9).
 *
 * Mount-time helper extracted from usePushNotification. Pure async function with
 * all side effects injected, so no React rendering is needed.
 *
 * Decides between three actions:
 *   - "cleanup": subscription exists but browser permission no longer "granted"
 *     → unsubscribe locally + DELETE backend. User revoked notification
 *     permission at the browser level; we mirror that on the server.
 *   - "keep":    subscription exists and permission still granted → no POST.
 *   - "no-op":   no local subscription → nothing to do.
 *
 * The previous implementation re-POSTed the existing subscription on every
 * page mount, which wasted bandwidth and silently re-registered a subscription
 * the user thought they had revoked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { executeMountConsistencyCheck } = await import(
  "@/hooks/usePushNotification.js"
);

function makeSubscription(overrides = {}) {
  return {
    endpoint: "https://push.example.com/abc",
    unsubscribe: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("executeMountConsistencyCheck", () => {
  let log;

  beforeEach(() => {
    log = vi.fn();
  });

  it("returns 'keep' and performs no side effects when sub exists and permission=granted", async () => {
    const subscription = makeSubscription();
    const deleteBackend = vi.fn();

    const action = await executeMountConsistencyCheck({
      subscription,
      permission: "granted",
      deleteBackend,
      log,
    });

    expect(action).toBe("keep");
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(deleteBackend).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("returns 'cleanup' and unsubscribes + DELETEs backend when permission=denied", async () => {
    const subscription = makeSubscription();
    const deleteBackend = vi.fn().mockResolvedValue(true);

    const action = await executeMountConsistencyCheck({
      subscription,
      permission: "denied",
      deleteBackend,
      log,
    });

    expect(action).toBe("cleanup");
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(deleteBackend).toHaveBeenCalledWith(subscription.endpoint);
  });

  it("returns 'cleanup' when permission=default (user hasn't granted)", async () => {
    const subscription = makeSubscription();
    const deleteBackend = vi.fn().mockResolvedValue(true);

    const action = await executeMountConsistencyCheck({
      subscription,
      permission: "default",
      deleteBackend,
      log,
    });

    expect(action).toBe("cleanup");
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(deleteBackend).toHaveBeenCalledWith(subscription.endpoint);
  });

  it("returns 'no-op' when there is no local subscription", async () => {
    const deleteBackend = vi.fn();

    const action = await executeMountConsistencyCheck({
      subscription: null,
      permission: "granted",
      deleteBackend,
      log,
    });

    expect(action).toBe("no-op");
    expect(deleteBackend).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("still unsubscribes locally and logs the backend error when deleteBackend rejects", async () => {
    const subscription = makeSubscription();
    const backendErr = new Error("network down");
    const deleteBackend = vi.fn().mockRejectedValue(backendErr);

    const action = await executeMountConsistencyCheck({
      subscription,
      permission: "denied",
      deleteBackend,
      log,
    });

    expect(action).toBe("cleanup");
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(deleteBackend).toHaveBeenCalledWith(subscription.endpoint);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("consistency cleanup"),
      backendErr,
    );
  });

  it("does not throw if subscription.unsubscribe rejects; logs and returns 'cleanup'", async () => {
    const unsubErr = new Error("unsub failed");
    const subscription = makeSubscription({
      unsubscribe: vi.fn().mockRejectedValue(unsubErr),
    });
    const deleteBackend = vi.fn().mockResolvedValue(true);

    const action = await executeMountConsistencyCheck({
      subscription,
      permission: "denied",
      deleteBackend,
      log,
    });

    expect(action).toBe("cleanup");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("consistency cleanup"),
      unsubErr,
    );
  });
});
