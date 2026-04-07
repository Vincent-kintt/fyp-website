import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "user123" } })),
}));

// Mock AI SDK generateText
const mockGenerateText = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateText: (...args) => mockGenerateText(...args),
  };
});

// Mock provider
vi.mock("@/lib/ai/provider.js", () => ({
  getModel: vi.fn(() => "mock-model"),
}));

const { POST } = await import("@/app/api/ai/parse-task/route.js");

function makeRequest(body) {
  return new Request("http://localhost/api/ai/parse-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("parse-task with Output.object()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses structured output when model returns valid object", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        title: "Buy groceries",
        tags: ["shopping"],
        priority: "medium",
        date_expression: "tomorrow at 3:00 pm",
        is_task: true,
        matched_text: "buy groceries tomorrow 3pm",
      },
      text: "",
    });

    const res = await POST(
      makeRequest({ text: "buy groceries tomorrow 3pm" }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.title).toBe("Buy groceries");
    expect(json.data.tags).toEqual(["shopping"]);
    expect(json.data.isTask).toBe(true);
    expect(json.data.dateTime).toBeDefined();
  });

  it("falls back to manual parse when NoObjectGeneratedError is thrown", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "Failed to parse",
      text: '{"title": "Meeting", "tags": ["work"], "priority": "high", "date_expression": "today at 2pm", "is_task": true, "matched_text": "meeting today 2pm"}',
      usage: { promptTokens: 10, completionTokens: 20 },
    });

    mockGenerateText.mockRejectedValue(error);

    const res = await POST(makeRequest({ text: "meeting today 2pm" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.title).toBe("Meeting");
    expect(json.data.priority).toBe("high");
  });

  it("returns safe default when both structured output and manual parse fail", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "Failed",
      text: "completely invalid garbage",
      usage: { promptTokens: 10, completionTokens: 5 },
    });

    mockGenerateText.mockRejectedValue(error);

    const res = await POST(makeRequest({ text: "do something" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.title).toBe("do something");
  });

  it("rejects unauthenticated requests", async () => {
    const { auth } = await import("@/auth");
    auth.mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ text: "test" }));
    expect(res.status).toBe(401);
  });

  it("rejects empty text", async () => {
    const res = await POST(makeRequest({ text: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects text over 2000 characters", async () => {
    const res = await POST(makeRequest({ text: "a".repeat(2001) }));
    expect(res.status).toBe(400);
  });
});
