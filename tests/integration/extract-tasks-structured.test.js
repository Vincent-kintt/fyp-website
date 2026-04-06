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

const { POST } = await import("@/app/api/ai/extract-tasks/route.js");

function makeRequest(body) {
  return new Request("http://localhost/api/ai/extract-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("extract-tasks with Output.array()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts tasks from structured output", async () => {
    mockGenerateText.mockResolvedValue({
      output: [
        {
          title: "Buy milk",
          dateTime: "2026-04-08T09:00",
          priority: "low",
          tags: ["shopping"],
        },
        {
          title: "Submit report",
          dateTime: "2026-04-08T17:00",
          priority: "high",
          tags: ["work"],
        },
      ],
      text: "",
    });

    const res = await POST(
      makeRequest({
        text: "Need to buy milk and submit report by tomorrow 5pm",
      }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.tasks).toHaveLength(2);
    expect(json.data.tasks[0].title).toBe("Buy milk");
    expect(json.data.tasks[1].priority).toBe("high");
  });

  it("returns empty array when no tasks found", async () => {
    mockGenerateText.mockResolvedValue({
      output: [],
      text: "",
    });

    const res = await POST(
      makeRequest({ text: "The weather is nice today" }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.tasks).toEqual([]);
  });

  it("falls back to manual parse on NoObjectGeneratedError", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "Failed",
      text: '[{"title": "Call dentist", "dateTime": null, "priority": "medium", "tags": ["health"]}]',
      usage: { promptTokens: 10, completionTokens: 20 },
    });

    mockGenerateText.mockRejectedValue(error);

    const res = await POST(makeRequest({ text: "Call dentist sometime" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.tasks).toHaveLength(1);
    expect(json.data.tasks[0].title).toBe("Call dentist");
  });

  it("returns empty array when all parsing fails", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "Failed",
      text: "not valid json at all",
      usage: { promptTokens: 10, completionTokens: 5 },
    });

    mockGenerateText.mockRejectedValue(error);

    const res = await POST(makeRequest({ text: "something" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.tasks).toEqual([]);
  });

  it("filters out tasks with missing title from fallback parse", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "Failed",
      text: '[{"title": "Valid task", "priority": "medium", "tags": []}, {"priority": "low", "tags": []}]',
      usage: { promptTokens: 10, completionTokens: 20 },
    });

    mockGenerateText.mockRejectedValue(error);

    const res = await POST(makeRequest({ text: "test" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.tasks).toHaveLength(1);
    expect(json.data.tasks[0].title).toBe("Valid task");
  });

  it("handles confirmedTasks exclusion in prompt", async () => {
    mockGenerateText.mockResolvedValue({
      output: [
        { title: "New task only", dateTime: null, priority: "medium", tags: [] },
      ],
      text: "",
    });

    const res = await POST(
      makeRequest({
        text: "Buy milk and new task only",
        confirmedTasks: ["Buy milk"],
      }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.system).toContain("Buy milk");
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

  it("truncates text over 8000 chars and reports it", async () => {
    mockGenerateText.mockResolvedValue({
      output: [],
      text: "",
    });

    const res = await POST(makeRequest({ text: "a".repeat(9000) }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.truncated).toBe(true);
  });
});
