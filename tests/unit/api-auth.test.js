/**
 * Unit tests for lib/api/auth.js — requireAuth, withAuth, withCronAuth.
 *
 * Centralized session-check and cron-token-check helpers shared across
 * app/api/**\/route.js. Wrappers (withAuth / withCronAuth) also handle
 * the route-level try/catch + 500 fallback so handlers can stay focused
 * on the happy path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args) => authMock(...args),
}));

const { requireAuth, withAuth } = await import("@/lib/api/auth.js");
const { withCronAuth } = await import("@/lib/api/cronAuth.js");

let consoleErrorSpy;

beforeEach(() => {
  authMock.mockReset();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  delete process.env.CRON_SECRET;
});

async function readJson(res) {
  const text = await res.text();
  return JSON.parse(text);
}

describe("requireAuth", () => {
  it("returns session and userId when authenticated", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", username: "alice" } });
    const { session, userId, error } = await requireAuth();
    expect(error).toBeNull();
    expect(userId).toBe("u1");
    expect(session.user.username).toBe("alice");
  });

  it("returns 401 error response when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const { session, userId, error } = await requireAuth();
    expect(session).toBeNull();
    expect(userId).toBeNull();
    expect(error).toBeInstanceOf(Response);
    expect(error.status).toBe(401);
    const body = await readJson(error);
    expect(body).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns 401 when session exists but user is missing", async () => {
    authMock.mockResolvedValue({ user: null });
    const { error } = await requireAuth();
    expect(error?.status).toBe(401);
  });
});

describe("withAuth", () => {
  it("calls handler with { request, context, params, session, userId } when authed", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const handler = vi.fn(async () => new Response("ok"));
    const route = withAuth(handler);
    const request = new Request("http://localhost/test");
    const context = { params: Promise.resolve({ id: "abc" }) };
    const res = await route(request, context);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const arg = handler.mock.calls[0][0];
    expect(arg.request).toBe(request);
    expect(arg.context).toBe(context);
    expect(arg.params).toBe(context.params);
    expect(arg.userId).toBe("u1");
    expect(arg.session.user.id).toBe("u1");
  });

  it("returns 401 without calling handler when not authed", async () => {
    authMock.mockResolvedValue(null);
    const handler = vi.fn();
    const route = withAuth(handler);
    const res = await route(new Request("http://localhost/test"));
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    const body = await readJson(res);
    expect(body).toEqual({ success: false, error: "Unauthorized" });
  });

  it("passes handler return value through (any Response type)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const streamLike = new Response("stream-body", { status: 207 });
    const route = withAuth(async () => streamLike);
    const res = await route(new Request("http://localhost/test"));
    expect(res).toBe(streamLike);
    expect(res.status).toBe(207);
  });

  it("returns 500 apiError when handler throws", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const route = withAuth(async () => {
      throw new Error("boom");
    });
    const res = await route(new Request("http://localhost/test"));
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body).toEqual({
      success: false,
      error: "Internal server error",
    });
  });

  it("uses custom errorMessage option in 500 response", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const route = withAuth(
      async () => {
        throw new Error("boom");
      },
      { errorMessage: "Failed to process request" },
    );
    const res = await route(new Request("http://localhost/test"));
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe("Failed to process request");
  });

  it("logs error to console with label prefix", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const route = withAuth(
      async () => {
        throw new Error("boom");
      },
      { label: "GET /api/foo" },
    );
    await route(new Request("http://localhost/test"));
    expect(consoleErrorSpy).toHaveBeenCalled();
    const firstArg = consoleErrorSpy.mock.calls[0][0];
    expect(firstArg).toContain("GET /api/foo");
  });

  it("does not call console.error when handler returns successfully", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const route = withAuth(async () => new Response("ok"));
    await route(new Request("http://localhost/test"));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("returns 500 apiError when auth() itself throws", async () => {
    authMock.mockRejectedValue(new Error("auth provider unreachable"));
    const handler = vi.fn();
    const route = withAuth(handler, { label: "GET /api/foo" });
    const res = await route(new Request("http://localhost/test"));
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body).toEqual({
      success: false,
      error: "Internal server error",
    });
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("GET /api/foo");
  });

  // Auth-scoped responses must never be cached by edge proxies / CDNs because
  // they contain per-user data. The wrapper is the single source of truth —
  // every exit path (handler-return, 401, 500) gets "private, no-store" unless
  // the handler set an explicit Cache-Control header (opt-in public caching).
  describe("auth-scoped cache contract", () => {
    it("adds Cache-Control: private, no-store on the success path", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      const route = withAuth(async () =>
        new Response(JSON.stringify({ success: true, data: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const res = await route(new Request("http://localhost/test"));
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("adds Cache-Control: private, no-store on the 401 path", async () => {
      authMock.mockResolvedValue(null);
      const handler = vi.fn();
      const route = withAuth(handler);
      const res = await route(new Request("http://localhost/test"));
      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(401);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("adds Cache-Control: private, no-store on the 500 path", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      const route = withAuth(async () => {
        throw new Error("boom");
      });
      const res = await route(new Request("http://localhost/test"));
      expect(res.status).toBe(500);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      const body = await readJson(res);
      expect(body).toEqual({
        success: false,
        error: "Internal server error",
      });
    });

    it("preserves explicit Cache-Control set by the handler", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      const route = withAuth(
        async () =>
          new Response("ok", {
            status: 200,
            headers: { "Cache-Control": "public, max-age=60" },
          }),
      );
      const res = await route(new Request("http://localhost/test"));
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    });

    it("adds Cache-Control on a streaming-shape response and preserves Content-Type", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: ping\n\n"));
          controller.close();
        },
      });
      const route = withAuth(
        async () =>
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
      );
      const res = await route(new Request("http://localhost/test"));
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    });
  });
});

describe("withCronAuth", () => {
  it("calls handler when bearer token matches CRON_SECRET", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const handler = vi.fn(async () => new Response("ok"));
    const route = withCronAuth(handler);
    const request = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer s3cr3t" },
    });
    const res = await route(request);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it("returns 401 when CRON_SECRET env is missing", async () => {
    delete process.env.CRON_SECRET;
    const handler = vi.fn();
    const route = withCronAuth(handler);
    const request = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer anything" },
    });
    const res = await route(request);
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const handler = vi.fn();
    const route = withCronAuth(handler);
    const request = new Request("http://localhost/cron");
    const res = await route(request);
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token does not match", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const handler = vi.fn();
    const route = withCronAuth(handler);
    const request = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer wrong" },
    });
    const res = await route(request);
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("returns 500 apiError when handler throws", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const route = withCronAuth(
      async () => {
        throw new Error("kaboom");
      },
      { label: "GET /api/cron/notify" },
    );
    const request = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer s3cr3t" },
    });
    const res = await route(request);
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body).toEqual({
      success: false,
      error: "Internal server error",
    });
    expect(consoleErrorSpy.mock.calls[0][0]).toContain(
      "GET /api/cron/notify",
    );
  });
});
