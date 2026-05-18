import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import { setupApiMocks, createRequest, parseResponse } from "../helpers/api.js";

// Setup mocks BEFORE importing route handlers
setupApiMocks(getDb);

// The register route shouldn't need next-auth's session, but the helper mocks
// `@/auth` for the rest of the suite — importing it here gives us a clean
// slate for the register-specific assertions.
const { POST } = await import("@/app/api/auth/register/route.js");
const { createUserIndexes } = await import("@/scripts/createUserIndexes.js");

beforeAll(async () => {
  await startDb("test_auth_register_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  // Register's collision-to-409 path now relies on the username/email unique
  // indexes (see scripts/createUserIndexes.js); recreate them after each
  // clearDb so the 409 paths can fire.
  await createUserIndexes(getDb());
});

const VALID_BODY = {
  username: "alice",
  email: "alice@example.com",
  password: "password123",
};

describe("POST /api/auth/register — auth-scoped cache contract", () => {
  // Register echoes account state (username/email collision answers,
  // success-with-id). Edge proxies / CDNs must never cache these per-account
  // answers, so every exit path carries `Cache-Control: private, no-store`.

  it("sets Cache-Control: private, no-store on the success path", async () => {
    const req = createRequest("POST", "/api/auth/register", {
      body: VALID_BODY,
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Cache-Control: private, no-store on the validation 400 path", async () => {
    const req = createRequest("POST", "/api/auth/register", {
      body: { username: "", email: "", password: "" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Cache-Control: private, no-store on the 409 username-conflict path", async () => {
    const db = getDb();
    await db.collection("users").insertOne({
      username: VALID_BODY.username,
      email: "different@example.com",
      password: "hash",
      role: "user",
      createdAt: new Date(),
    });

    const req = createRequest("POST", "/api/auth/register", {
      body: VALID_BODY,
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(409);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Cache-Control: private, no-store on the 500 server-error path", async () => {
    // Force getCollection to throw — exercising the catch-block 500 return.
    const dbModule = await import("@/lib/db.js");
    const original = dbModule.getCollection;
    const spy = vi.spyOn(dbModule, "getCollection").mockImplementation(() => {
      throw new Error("simulated db outage");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const req = createRequest("POST", "/api/auth/register", {
        body: VALID_BODY,
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    } finally {
      spy.mockRestore();
      consoleSpy.mockRestore();
      // restore original reference for downstream tests
      if (dbModule.getCollection !== original) {
        dbModule.getCollection = original;
      }
    }
  });
});
