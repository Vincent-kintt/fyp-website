import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb);

const { POST } = await import("@/app/api/ai/execute-tool/route.js");

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

beforeAll(async () => {
  await startDb("test_execute_tool_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("POST /api/ai/execute-tool", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("POST", "/api/ai/execute-tool", {
      body: { toolName: "listReminders", params: { filter: "all" } },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 400 when toolName is missing", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/ai/execute-tool", {
      body: { params: {} },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/tool name/i);
  });

  it("returns 403 for disallowed tool (createReminder)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/ai/execute-tool", {
      body: {
        toolName: "createReminder",
        params: { title: "Hack", dateTime: "2026-01-01T00:00" },
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(403);
    expect(body.error).toMatch(/not allowed/i);
  });

  it("returns 403 for disallowed tool (deleteReminder)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/ai/execute-tool", {
      body: { toolName: "deleteReminder", params: { reminderId: "abc" } },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(403);
    expect(body.error).toMatch(/not allowed/i);
  });

  it("returns 403 for disallowed tool (updateReminder)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/ai/execute-tool", {
      body: { toolName: "updateReminder", params: {} },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(403);
    expect(body.error).toMatch(/not allowed/i);
  });

  it("allows listReminders (read-only tool)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/ai/execute-tool", {
      body: { toolName: "listReminders", params: { filter: "all" } },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 400 for invalid tool input (schema validation)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/ai/execute-tool", {
      body: { toolName: "listReminders", params: { filter: "invalid_filter" } },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid tool input/i);
  });
});
