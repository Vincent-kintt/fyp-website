/**
 * Tests for handlePushSubscriptionChange (M9).
 *
 * The function lives in public/sw.js because service workers cannot import
 * ESM from @/lib (the SW is registered as a classic worker script and runs
 * in its own global scope without access to the app's module graph).
 *
 * To unit-test it we evaluate sw.js inside a Node `vm` sandbox with stub
 * globals, harvest the `handlePushSubscriptionChange` symbol, and exercise it
 * directly. This keeps a single source of truth for the SW logic without a
 * build step that duplicates it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SW_PATH = path.resolve(__dirname, "../../../public/sw.js");

function makeSandbox() {
  return {
    self: {
      addEventListener: vi.fn(),
      registration: {},
      clients: { matchAll: vi.fn(), claim: vi.fn(), openWindow: vi.fn() },
      skipWaiting: vi.fn(),
    },
    console,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    fetch: vi.fn(),
    Uint8Array,
  };
}

function loadSwHandler() {
  const source = readFileSync(SW_PATH, "utf8");
  const sandbox = makeSandbox();
  vm.createContext(sandbox);
  // Expose the handler under self so the test can grab it.
  const wrapped = `${source}\nself.__handlePushSubscriptionChange = handlePushSubscriptionChange;`;
  vm.runInContext(wrapped, sandbox);
  return sandbox.self.__handlePushSubscriptionChange;
}

function makeSubscription(overrides = {}) {
  return {
    endpoint: "https://push.example.com/abc",
    getKey: (name) => {
      if (name === "p256dh") return new Uint8Array([1, 2, 3]).buffer;
      if (name === "auth") return new Uint8Array([4, 5, 6]).buffer;
      return null;
    },
    ...overrides,
  };
}

function makeSwRegistration(subscribeImpl) {
  return {
    pushManager: {
      subscribe: vi.fn(subscribeImpl),
    },
  };
}

describe("handlePushSubscriptionChange", () => {
  let log;

  beforeEach(() => {
    log = vi.fn();
  });

  it("re-subscribes with VAPID key and POSTs new endpoint when subscribe() succeeds", async () => {
    const handler = loadSwHandler();
    expect(handler).toBeTypeOf("function");

    const newSub = makeSubscription({ endpoint: "https://push.example.com/new" });
    const swRegistration = makeSwRegistration(() => Promise.resolve(newSub));
    const postToBackend = vi.fn().mockResolvedValue(true);
    const vapidKey = "BAA-not-a-real-key-but-base64url";

    await handler({ swRegistration, vapidKey, postToBackend, log });

    expect(swRegistration.pushManager.subscribe).toHaveBeenCalledTimes(1);
    const subscribeArg = swRegistration.pushManager.subscribe.mock.calls[0][0];
    expect(subscribeArg.userVisibleOnly).toBe(true);
    expect(subscribeArg.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(postToBackend).toHaveBeenCalledTimes(1);
    expect(postToBackend).toHaveBeenCalledWith(newSub);
  });

  it("logs and does not crash when subscribe() rejects", async () => {
    const handler = loadSwHandler();
    const subErr = new Error("push service down");
    const swRegistration = makeSwRegistration(() => Promise.reject(subErr));
    const postToBackend = vi.fn();

    await handler({
      swRegistration,
      vapidKey: "BAA-fake",
      postToBackend,
      log,
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("pushsubscriptionchange"),
      subErr,
    );
    expect(postToBackend).not.toHaveBeenCalled();
  });

  it("logs and bails when VAPID key is missing", async () => {
    const handler = loadSwHandler();
    const swRegistration = makeSwRegistration(() => Promise.resolve(makeSubscription()));
    const postToBackend = vi.fn();

    await handler({
      swRegistration,
      vapidKey: null,
      postToBackend,
      log,
    });

    expect(swRegistration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(postToBackend).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("VAPID key"),
    );
  });

  it("registers a pushsubscriptionchange listener on self at SW load time", () => {
    const source = readFileSync(SW_PATH, "utf8");
    const sandbox = makeSandbox();
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);

    const events = sandbox.self.addEventListener.mock.calls.map(
      (call) => call[0],
    );
    expect(events).toContain("pushsubscriptionchange");
  });
});
