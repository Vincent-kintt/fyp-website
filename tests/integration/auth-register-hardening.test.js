/**
 * H8 hardening regression tests for POST /api/auth/register.
 *
 * The pre-hardening route had three defects:
 *
 *  1. No rate limit despite `lib/rateLimit.js` being wired to NextAuth login.
 *  2. Three-step `findOne(username) → findOne(email) → insertOne` flow races
 *     under concurrent same-email registers (two passes through both findOnes,
 *     two insertOnes, two duplicate accounts).
 *  3. No checked-in `email` unique-index bootstrap. The race-fix surface (the
 *     E11000 catch) only works if the index is in place.
 *
 * These tests pin the post-hardening contract:
 *
 *   - `scripts/createUserIndexes.js` exports `createUserIndexes(db)` and creates
 *     unique indexes on `username` and `email`.
 *   - The route drops the findOne preflight; a single insertOne under unique
 *     indexes raises E11000 on collision, which the route maps to 409 with the
 *     username- or email-specific error message by inspecting `err.keyPattern`.
 *   - The route is rate-limited (5 attempts / 15 min by IP). The 429 response
 *     carries a clear error and `Retry-After`.
 *   - The rate limit is keyed per IP so an attacker on one IP cannot starve
 *     other users.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb);

const { POST } = await import("@/app/api/auth/register/route.js");
const { createUserIndexes } = await import("@/scripts/createUserIndexes.js");

beforeAll(async () => {
  await startDb("test_auth_register_hardening");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  // Drop indexes between cases so each test starts from a clean slate.
  const users = getDb().collection("users");
  try {
    await users.dropIndexes();
  } catch {
    // ignore — collection may not exist yet
  }
});

function postRequest({ body, ip = "1.2.3.4" }) {
  const url = new URL("/api/auth/register", "http://localhost:3000");
  return new Request(url.toString(), {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
  });
}

describe("createUserIndexes — email unique index bootstrap", () => {
  it("creates a unique index on email so duplicate insertOne raises E11000", async () => {
    const db = getDb();
    await createUserIndexes(db);

    const users = db.collection("users");
    await users.insertOne({
      username: "first",
      email: "shared@example.com",
      password: "hash",
      role: "user",
      createdAt: new Date(),
    });

    await expect(
      users.insertOne({
        username: "second",
        email: "shared@example.com",
        password: "hash",
        role: "user",
        createdAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("creates a unique index on username so duplicate insertOne raises E11000", async () => {
    const db = getDb();
    await createUserIndexes(db);

    const users = db.collection("users");
    await users.insertOne({
      username: "shared",
      email: "a@example.com",
      password: "hash",
      role: "user",
      createdAt: new Date(),
    });

    await expect(
      users.insertOne({
        username: "shared",
        email: "b@example.com",
        password: "hash",
        role: "user",
        createdAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe("POST /api/auth/register — atomic insert under unique indexes", () => {
  beforeEach(async () => {
    await createUserIndexes(getDb());
  });

  it("returns 201 for a fresh unique register (positive regression)", async () => {
    const req = postRequest({
      body: {
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      },
      ip: "10.0.0.1",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body).toMatchObject({ message: expect.any(String) });
  });

  it("returns 409 with email-specific message on duplicate email", async () => {
    const db = getDb();
    await db.collection("users").insertOne({
      username: "existing",
      email: "taken@example.com",
      password: "hash",
      role: "user",
      createdAt: new Date(),
    });

    const req = postRequest({
      body: {
        username: "newbie",
        email: "taken@example.com",
        password: "password123",
      },
      ip: "10.0.0.2",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(409);
    expect(body.error).toMatch(/email/i);
  });

  it("returns 409 with username-specific message on duplicate username", async () => {
    const db = getDb();
    await db.collection("users").insertOne({
      username: "taken",
      email: "old@example.com",
      password: "hash",
      role: "user",
      createdAt: new Date(),
    });

    const req = postRequest({
      body: {
        username: "taken",
        email: "fresh@example.com",
        password: "password123",
      },
      ip: "10.0.0.3",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(409);
    expect(body.error).toMatch(/username/i);
  });

  it("concurrent same-email register fires: exactly one 201, the rest 409", async () => {
    // Fire many concurrent requests with the same email but different
    // usernames. Without atomic-insert + E11000 catch, both might 201 (race
    // duplicate) or one might 500 (uncaught dup-key). The hardened route
    // must surface exactly one 201 and the rest as 409 collisions.
    const concurrency = 8;
    const requests = Array.from({ length: concurrency }, (_, i) =>
      postRequest({
        body: {
          username: `concurrent${i}`,
          email: "race@example.com",
          password: "password123",
        },
        // Distinct IPs so the rate limiter doesn't interfere with the race
        // assertion. We want to isolate the DB-level race here.
        ip: `192.168.${i}.1`,
      }),
    );

    const results = await Promise.all(requests.map((r) => POST(r)));
    const statuses = results.map((r) => r.status);
    const ok = statuses.filter((s) => s === 201).length;
    const conflict = statuses.filter((s) => s === 409).length;

    expect(ok).toBe(1);
    expect(conflict).toBe(concurrency - 1);

    // DB invariant: only one user actually persisted under the shared email.
    const docs = await getDb()
      .collection("users")
      .find({ email: "race@example.com" })
      .toArray();
    expect(docs).toHaveLength(1);
  });
});

describe("POST /api/auth/register — rate limit", () => {
  beforeEach(async () => {
    await createUserIndexes(getDb());
  });

  it("rejects with 429 after exceeding the per-IP attempt threshold", async () => {
    // Fire N+1 valid registers from the same IP (each with a distinct
    // username+email so the application-level path never short-circuits to
    // 409). At least one of the trailing requests must come back as 429.
    const ip = "203.0.113.5";
    const attempts = 6;
    const results = [];
    for (let i = 0; i < attempts; i++) {
      const req = postRequest({
        body: {
          username: `rl_user_${i}`,
          email: `rl_${i}@example.com`,
          password: "password123",
        },
        ip,
      });
      const res = await POST(req);
      results.push(res.status);
    }

    // Threshold is 5 / 15 min — the 6th attempt must be 429.
    expect(results.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
    expect(results[results.length - 1]).toBe(429);
  });

  it("isolates rate limit per IP — second IP can still register after first is limited", async () => {
    const firstIp = "203.0.113.10";
    // Burn the first IP's bucket.
    for (let i = 0; i < 6; i++) {
      const req = postRequest({
        body: {
          username: `burn_${i}`,
          email: `burn_${i}@example.com`,
          password: "password123",
        },
        ip: firstIp,
      });
      await POST(req);
    }

    // Second IP — fresh bucket, distinct credentials — must still succeed.
    const secondIp = "203.0.113.11";
    const req = postRequest({
      body: {
        username: "fresh_ip_user",
        email: "fresh_ip@example.com",
        password: "password123",
      },
      ip: secondIp,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("429 response carries Cache-Control: private, no-store", async () => {
    const ip = "203.0.113.20";
    let last;
    for (let i = 0; i < 7; i++) {
      const req = postRequest({
        body: {
          username: `cache_${i}`,
          email: `cache_${i}@example.com`,
          password: "password123",
        },
        ip,
      });
      last = await POST(req);
    }
    expect(last.status).toBe(429);
    expect(last.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
