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
  getParseModelId: vi.fn(() => "mock-parse-model"),
}));

// H10 — rate limit gate. The dedicated tests/integration/aiRateLimit.test.js
// exercises the real limiter; here we mock it to a pass so this suite
// can test the parse-task pipeline in isolation.
vi.mock("@/lib/rateLimit/aiRateLimiter.js", () => ({
  consumeAILimit: vi.fn(async () => ({ ok: true })),
}));

const { POST } = await import("@/app/api/ai/parse-task/route.js");
const { REMINDER_CATEGORIES } = await import("@/lib/utils.js");

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
    // Canonical tag ("work") passes the code-side taxonomy filter unchanged —
    // verifies the pipeline forwards a valid auto-classified tag end to end.
    mockGenerateText.mockResolvedValue({
      output: {
        title: "Buy groceries",
        tags: ["work"],
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
    expect(json.data.tags).toEqual(["work"]);
    expect(json.data.isTask).toBe(true);
    expect(json.data.dateTime).toBeDefined();
  });

  it("instructs the model to classify into the canonical categories", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        title: "Task",
        tags: [],
        priority: "medium",
        date_expression: "",
        is_task: true,
        matched_text: "task",
      },
      text: "",
    });

    await POST(makeRequest({ text: "task" }));

    const systemPrompt = mockGenerateText.mock.calls[0][0].system;
    expect(systemPrompt).toContain("classify");
    for (const category of REMINDER_CATEGORIES) {
      expect(systemPrompt).toContain(category);
    }
  });

  it("filters out auto-classified tags outside the canonical taxonomy", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        title: "Finish report",
        tags: ["work", "shopping"],
        priority: "medium",
        date_expression: "",
        is_task: true,
        matched_text: "finish report",
      },
      text: "",
    });

    const res = await POST(makeRequest({ text: "finish report" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.tags).toEqual(["work"]);
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

  it("sanitizes invalid priority from salvage path to 'medium'", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "Failed to parse",
      text: '{"title": "Urgent task", "tags": ["work"], "priority": "urgent", "date_expression": "", "is_task": true, "matched_text": "urgent task"}',
      usage: { promptTokens: 10, completionTokens: 20 },
    });

    mockGenerateText.mockRejectedValue(error);

    const res = await POST(makeRequest({ text: "urgent task" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.title).toBe("Urgent task");
    expect(json.data.priority).toBe("medium");
  });

  it("sanitizes non-array tags from salvage path", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "Failed to parse",
      text: '{"title": "Some task", "tags": "not-an-array", "priority": "high", "is_task": true, "matched_text": "some task"}',
      usage: { promptTokens: 10, completionTokens: 20 },
    });

    mockGenerateText.mockRejectedValue(error);

    const res = await POST(makeRequest({ text: "some task" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.title).toBe("Some task");
    expect(json.data.tags).toEqual([]);
    expect(json.data.priority).toBe("high");
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
