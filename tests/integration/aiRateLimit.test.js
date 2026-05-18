/**
 * H10 — Per-user rate limit on AI streaming endpoints.
 *
 * AI endpoints used to have zero rate limiting. A logged-in user firing
 * dozens of streaming requests via dev tools would exhaust the
 * OpenRouter quota and take down AI features for everyone. The fix
 * pushes a sliding-window per-user limiter into MongoDB via the
 * `rate-limiter-flexible` package (`RateLimiterMongo`) — same primitive
 * cluster M used for the user-AI lock, no new external service, no
 * payment.
 *
 * These tests pin the limiter module's contract directly (consume /
 * isolation / window reset) and lock the route-level integration by
 * exhausting the quota against `/api/ai/parse-task` and asserting a
 * 429 with a `Retry-After` header.
 *
 * Per CLAUDE.md the database is real (mongodb-memory-server) — mocking
 * Mongo in integration tests has masked migration breakage before.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { startDb, stopDb, clearDb, getDb, getClient } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb, getClient);

// The limiter resolves its target database from `process.env.MONGODB_DB`
// (the same env the rest of the app uses). The test harness pins both
// the env var and `startDb(dbName)` to the same value so `clearDb` (which
// iterates the test database's collections) actually wipes the limiter's
// `ai_rate_limits` collection between scenarios.
const TEST_DB_NAME = "test_ai_rate_limit";
process.env.MONGODB_DB = TEST_DB_NAME;

// Stub the AI SDK at module scope (vi.mock is hoisted). The route-level
// 429 test must not actually call OpenRouter; the limiter check fires
// before any model invocation anyway, but the stub also keeps the
// success path predictable for future expansion.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateText: async () => ({
      output: {
        title: "stub",
        tags: [],
        priority: "medium",
        date_expression: "",
        is_task: false,
        matched_text: "stub",
      },
    }),
  };
});

const { __resetLimiterForTests, consumeAILimit } = await import(
  "@/lib/rateLimit/aiRateLimiter.js"
);
const { POST: parseTaskPOST } = await import("@/app/api/ai/parse-task/route.js");

beforeAll(async () => {
  await startDb(TEST_DB_NAME);
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  // The limiter is a lazy singleton — reset so each test rebinds to the
  // current memory-server client (counts live in MongoDB; clearDb wipes
  // them).
  __resetLimiterForTests();
});

describe("consumeAILimit — limiter contract", () => {
  it("first N requests succeed, N+1th returns ok:false with retryAfterSeconds", async () => {
    const opts = { points: 5, duration: 60, blockDuration: 60 };
    for (let i = 0; i < opts.points; i += 1) {
      const res = await consumeAILimit("alice", opts);
      expect(res.ok).toBe(true);
    }
    const blocked = await consumeAILimit("alice", opts);
    expect(blocked.ok).toBe(false);
    expect(typeof blocked.retryAfterSeconds).toBe("number");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("retryAfterSeconds is bounded by blockDuration", async () => {
    const opts = { points: 1, duration: 1, blockDuration: 5 };
    await consumeAILimit("alice", opts);
    const blocked = await consumeAILimit("alice", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(5);
  });

  it("isolates per-user — alice's quota does not affect bob", async () => {
    const opts = { points: 2, duration: 60, blockDuration: 60 };
    await consumeAILimit("alice", opts);
    await consumeAILimit("alice", opts);
    const aliceBlocked = await consumeAILimit("alice", opts);
    expect(aliceBlocked.ok).toBe(false);

    const bob = await consumeAILimit("bob", opts);
    expect(bob.ok).toBe(true);
  });

  it("quota replenishes after the duration window", async () => {
    // Tiny duration / blockDuration so the test runs in ~1.2s without
    // fake timers. blockDuration must also be short or replenishment
    // is held by the block window.
    const opts = { points: 1, duration: 1, blockDuration: 1 };
    const first = await consumeAILimit("carol", opts);
    expect(first.ok).toBe(true);

    const blocked = await consumeAILimit("carol", opts);
    expect(blocked.ok).toBe(false);

    await new Promise((r) => setTimeout(r, 1200));

    const recovered = await consumeAILimit("carol", opts);
    expect(recovered.ok).toBe(true);
  });
});

describe("POST /api/ai/parse-task — route-level rate limit gate", () => {
  const TEST_USER = { id: "user-parse-task", username: "tester", role: "user" };

  it("returns 429 with Retry-After header after the per-user quota is exhausted", async () => {
    mockSession(TEST_USER);

    // The route's production limit is 20/min. Burn through that quota
    // via the limiter helper directly (same key the route uses), then
    // send one HTTP request and assert it bounces. This is faster than
    // 21 real generateText calls and proves the route reads from the
    // same store.
    for (let i = 0; i < 20; i += 1) {
      const res = await consumeAILimit(TEST_USER.id);
      expect(res.ok).toBe(true);
    }

    const req = createRequest("POST", "/api/ai/parse-task", {
      body: { text: "Buy milk tomorrow at 5pm" },
    });
    const res = await parseTaskPOST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(429);
    expect(body.error).toMatch(/rate limit/i);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
  });
});
