/**
 * Unit tests for lib/api/cache.js — ensureNoStore helper.
 *
 * Contract:
 *   `private, no-store` is mandatory for auth-scoped responses. The helper
 *   only honors an explicit `Cache-Control` opt-in when the header ALREADY
 *   includes `no-store`. Anything else (missing, `no-cache`, `public, ...`)
 *   is overwritten to `private, no-store`.
 *
 * Why overwrite, not preserve:
 *   AI SDK v6 `toUIMessageStreamResponse()` defaults to `Cache-Control:
 *   no-cache`. Without the overwrite, auth-scoped AI streaming routes
 *   would leak the no-store contract (no-cache allows revalidated caching).
 */
import { describe, expect, it } from "vitest";

import { ensureNoStore } from "@/lib/api/cache.js";

describe("ensureNoStore", () => {
  it("returns null unchanged (non-Response passthrough)", () => {
    expect(ensureNoStore(null)).toBeNull();
  });

  it("returns undefined unchanged (non-Response passthrough)", () => {
    expect(ensureNoStore(undefined)).toBeUndefined();
  });

  it("returns a non-Response value unchanged (string)", () => {
    expect(ensureNoStore("not a response")).toBe("not a response");
  });

  it("sets Cache-Control: private, no-store when header is missing", () => {
    const res = new Response("ok");
    const out = ensureNoStore(res);
    expect(out).toBe(res);
    expect(out.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("overwrites Cache-Control: no-cache (AI SDK default) with private, no-store", () => {
    // AI SDK v6 toUIMessageStreamResponse() sets `Cache-Control: no-cache` by
    // default. `no-cache` permits revalidated caching, which is NOT acceptable
    // for auth-scoped per-user data. Must be overwritten.
    const res = new Response("data: hi\n\n", {
      headers: { "Cache-Control": "no-cache" },
    });
    expect(ensureNoStore(res).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });

  it("overwrites Cache-Control: public, max-age=60 with private, no-store", () => {
    // Auth-scoped responses must never be publicly cacheable. A handler that
    // sets `public, max-age=N` is wrong for auth-scoped routes; the wrapper
    // is the single source of truth and corrects this at the boundary.
    const res = new Response("ok", {
      headers: { "Cache-Control": "public, max-age=60" },
    });
    expect(ensureNoStore(res).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });

  it("preserves Cache-Control: no-store unchanged", () => {
    const res = new Response("ok", {
      headers: { "Cache-Control": "no-store" },
    });
    expect(ensureNoStore(res).headers.get("Cache-Control")).toBe("no-store");
  });

  it("preserves Cache-Control: private, no-store, must-revalidate unchanged", () => {
    // A handler may want stricter semantics than the helper's default. As
    // long as the directive set ALREADY contains `no-store`, the contract
    // is upheld and the wrapper does not modify the header.
    const res = new Response("ok", {
      headers: { "Cache-Control": "private, no-store, must-revalidate" },
    });
    expect(ensureNoStore(res).headers.get("Cache-Control")).toBe(
      "private, no-store, must-revalidate",
    );
  });

  it("preserves Content-Type when overwriting Cache-Control", () => {
    // Streaming responses (e.g. SSE) must keep their content-type intact;
    // only the cache header is touched.
    const res = new Response("data: hi\n\n", {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
    const out = ensureNoStore(res);
    expect(out.headers.get("Cache-Control")).toBe("private, no-store");
    expect(out.headers.get("Content-Type")).toBe("text/event-stream");
  });

  // Redirect responses (Response.redirect()) and other framework-constructed
  // responses have immutable header guards per WHATWG fetch spec. NextAuth
  // signin/signout/callback flows return redirects — wrapper must NOT throw
  // when trying to write Cache-Control. Helper clones such responses with
  // a fresh, mutable Headers carrying the no-store directive.
  describe("immutable header fallback", () => {
    it("clones Response.redirect(302) with private, no-store and preserves Location", () => {
      const res = Response.redirect("https://example.com", 302);
      const out = ensureNoStore(res);
      expect(out).not.toBe(res); // a clone, not the same instance
      expect(out.status).toBe(302);
      expect(out.headers.get("Cache-Control")).toBe("private, no-store");
      expect(out.headers.get("Location")).toBe("https://example.com/");
    });

    it("clones Response.redirect(307) with private, no-store and preserves status", () => {
      const res = Response.redirect("https://example.com/dashboard", 307);
      const out = ensureNoStore(res);
      expect(out).not.toBe(res);
      expect(out.status).toBe(307);
      expect(out.headers.get("Cache-Control")).toBe("private, no-store");
      expect(out.headers.get("Location")).toBe("https://example.com/dashboard");
    });

    it("clones a response whose headers.set throws (synthetic immutable guard)", () => {
      // Simulate any framework-constructed response with a guarded Headers
      // (mirrors what Response.redirect produces). The helper must catch and
      // fall back to a clone.
      const headers = new Headers({ "Content-Type": "text/html" });
      headers.set = () => {
        throw new TypeError("Headers.set: Headers are immutable");
      };
      const res = new Response("body", { status: 302, headers });
      // Override `headers` getter so the cache helper sees our guarded instance.
      Object.defineProperty(res, "headers", { value: headers });

      const out = ensureNoStore(res);
      expect(out).not.toBe(res);
      expect(out.headers.get("Cache-Control")).toBe("private, no-store");
      expect(out.headers.get("Content-Type")).toBe("text/html");
      expect(out.status).toBe(302);
    });
  });
});
