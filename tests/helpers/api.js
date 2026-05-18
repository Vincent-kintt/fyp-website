import { vi } from "vitest";

let authMockFn = vi.fn();
let _getDbFn;
let _getClientFn;

// vi.mock calls are hoisted to top-level by Vitest — keep them at module scope
vi.mock("@/auth", () => ({
  auth: (...args) => authMockFn(...args),
}));

vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => {
    const db = _getDbFn();
    return db.collection(name);
  },
  // Mongo-backed primitives (locks, rate limiter) need the raw connected
  // MongoClient. The test harness wires this to the mongodb-memory-server
  // client; routes that don't need it just ignore the export.
  getMongoClient: async () => {
    if (!_getClientFn) {
      throw new Error(
        "getMongoClient mock requires setupApiMocks(getDbFn, getClientFn)",
      );
    }
    return _getClientFn();
  },
}));

export function setupApiMocks(getDbFn, getClientFn) {
  _getDbFn = getDbFn;
  _getClientFn = getClientFn;
}

export function mockSession(user) {
  if (!authMockFn) throw new Error("Call setupApiMocks() before mockSession()");
  if (user) {
    authMockFn.mockResolvedValue({ user });
  } else {
    authMockFn.mockResolvedValue(null);
  }
}

export function createRequest(method, pathname, { body, searchParams } = {}) {
  const url = new URL(pathname, "http://localhost:3000");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  const init = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url.toString(), init);
}

export function createCronRequest(pathname, secret) {
  const url = new URL(pathname, "http://localhost:3000");
  const headers = {};
  if (secret) {
    headers["authorization"] = `Bearer ${secret}`;
  }
  return new Request(url.toString(), { method: "GET", headers });
}

export function params(obj) {
  return { params: Promise.resolve(obj) };
}

export async function parseResponse(response) {
  const status = response.status;
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status, body };
}
