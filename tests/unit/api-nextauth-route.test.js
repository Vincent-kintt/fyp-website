/**
 * Unit tests for app/api/auth/[...nextauth]/route.js — the wrap pattern
 * that funnels NextAuth GET/POST + the rate-limited 429 short-circuit
 * through `ensureNoStore`.
 *
 * The NextAuth handlers themselves are out of scope; we mock them and
 * verify the route module re-exports wrapped versions that add the
 * auth-scoped cache header.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getHandlerMock = vi.fn();
const postHandlerMock = vi.fn();
const checkRateLimitMock = vi.fn();

vi.mock("@/auth", () => ({
  handlers: {
    GET: (...args) => getHandlerMock(...args),
    POST: (...args) => postHandlerMock(...args),
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args) => checkRateLimitMock(...args),
}));

const route = await import("@/app/api/auth/[...nextauth]/route.js");

beforeEach(() => {
  getHandlerMock.mockReset();
  postHandlerMock.mockReset();
  checkRateLimitMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NextAuth route wrap pattern", () => {
  it("GET adds Cache-Control: private, no-store to NextAuth handler responses", async () => {
    // NextAuth GET serves session JSON / OAuth callbacks. These carry
    // per-user data and must never be cached by edge proxies / CDNs.
    getHandlerMock.mockResolvedValue(new Response("ok", { status: 200 }));
    const req = new Request("http://localhost/api/auth/session");
    const res = await route.GET(req);
    expect(getHandlerMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("GET overwrites a public Cache-Control set by the NextAuth handler", async () => {
    // NextAuth session/CSRF responses must never reach an edge proxy. Even
    // if a handler returned `public, max-age=N`, the wrapper enforces the
    // auth-scoped contract at the boundary.
    getHandlerMock.mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: { "Cache-Control": "public, max-age=60" },
      }),
    );
    const req = new Request("http://localhost/api/auth/csrf");
    const res = await route.GET(req);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("GET overwrites Cache-Control: no-cache with private, no-store", async () => {
    // `no-cache` permits revalidated caching, which still leaks per-user
    // session shape. Wrapper must overwrite.
    getHandlerMock.mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: { "Cache-Control": "no-cache" },
      }),
    );
    const req = new Request("http://localhost/api/auth/session");
    const res = await route.GET(req);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("POST adds Cache-Control: private, no-store on the rate-limited 429 short-circuit", async () => {
    // The 429 path is local to this route — never reaches NextAuth — but the
    // contract is uniform: short-circuit responses must also be no-store.
    checkRateLimitMock.mockReturnValue({ success: false, resetMs: 60_000 });
    const req = new Request("http://localhost/api/auth/callback/credentials", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const res = await route.POST(req);
    expect(postHandlerMock).not.toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("POST adds Cache-Control: private, no-store on the NextAuth happy path", async () => {
    checkRateLimitMock.mockReturnValue({ success: true, resetMs: 0 });
    postHandlerMock.mockResolvedValue(new Response("ok", { status: 200 }));
    const req = new Request("http://localhost/api/auth/callback/credentials", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const res = await route.POST(req);
    expect(postHandlerMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("POST overwrites a public Cache-Control set by the NextAuth handler", async () => {
    checkRateLimitMock.mockReturnValue({ success: true, resetMs: 0 });
    postHandlerMock.mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: { "Cache-Control": "public, max-age=30" },
      }),
    );
    const req = new Request("http://localhost/api/auth/callback/credentials", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const res = await route.POST(req);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
