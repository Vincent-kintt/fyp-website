// tests/unit/ai/trimMessages.test.js
// Pair-aware message trimmer for AI SDK v6 ModelMessage history.
// The naive `[messages[0], ...slice(-tail)]` cap can strand a tool_result
// whose tool_call sits above the slice boundary — providers (Anthropic in
// particular) reject the request when a tool_result lacks its tool_call.
import { describe, it, expect } from "vitest";
import { trimMessagesKeepingToolPairs } from "@/lib/ai/trimMessages.js";

// Helpers to build ModelMessage-shaped fixtures concisely.
const system = (text) => ({ role: "system", content: text });
const user = (text) => ({ role: "user", content: text });
const assistantText = (text) => ({
  role: "assistant",
  content: [{ type: "text", text }],
});
const assistantToolCall = (toolCallId, toolName = "doThing", input = {}) => ({
  role: "assistant",
  content: [{ type: "tool-call", toolCallId, toolName, input }],
});
const toolResult = (toolCallId, toolName = "doThing", output = "ok") => ({
  role: "tool",
  content: [{ type: "tool-result", toolCallId, toolName, output }],
});

describe("trimMessagesKeepingToolPairs", () => {
  it("Case A: returns input unchanged when total messages <= keepFirst + tailCount", () => {
    const messages = [
      system("you are a helpful assistant"),
      user("hi"),
      assistantText("hello"),
    ];
    const result = trimMessagesKeepingToolPairs({
      messages,
      keepFirst: 1,
      tailCount: 20,
    });
    expect(result).toEqual(messages);
  });

  it("Case B: expands tail backwards to include a tool_call whose tool_result lands in the tail", () => {
    // 25 messages total. With keepFirst=1, tailCount=20, naive slice keeps
    // [0] + [5..24]. Place a tool_call at index 3 (early window, would be cut)
    // and its tool_result at index 22 (inside the tail). The helper must
    // include the tool_call to keep the pair intact.
    const messages = [
      system("sys"),
      user("u1"),
      user("u2"),
      assistantToolCall("call_A"),
      user("u3"),
      ...Array.from({ length: 17 }, (_, i) => user(`u${4 + i}`)),
      toolResult("call_A"),
      assistantText("done"),
      user("uLast"),
    ];
    expect(messages).toHaveLength(25);

    const result = trimMessagesKeepingToolPairs({
      messages,
      keepFirst: 1,
      tailCount: 20,
    });

    // Result must contain the tool_call AND the tool_result.
    const hasToolCallA = result.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === "tool-call" && p.toolCallId === "call_A",
        ),
    );
    const hasToolResultA = result.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === "tool-result" && p.toolCallId === "call_A",
        ),
    );
    expect(hasToolCallA).toBe(true);
    expect(hasToolResultA).toBe(true);
    // System message preserved at the front.
    expect(result[0]).toEqual(system("sys"));
  });

  it("Case C: tool_call and tool_result both in the tail — no change to either", () => {
    const messages = [
      system("sys"),
      ...Array.from({ length: 10 }, (_, i) => user(`early${i}`)),
      assistantToolCall("call_X"),
      toolResult("call_X"),
      ...Array.from({ length: 18 }, (_, i) => user(`late${i}`)),
    ];
    expect(messages).toHaveLength(31);

    const result = trimMessagesKeepingToolPairs({
      messages,
      keepFirst: 1,
      tailCount: 20,
    });

    const callIdx = result.findIndex(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === "tool-call" && p.toolCallId === "call_X",
        ),
    );
    const resultIdx = result.findIndex(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === "tool-result" && p.toolCallId === "call_X",
        ),
    );
    expect(callIdx).toBeGreaterThan(0);
    expect(resultIdx).toBeGreaterThan(callIdx);
  });

  it("Case D: tool_call sits exactly at the tail boundary — pair is kept whole", () => {
    // Place the tool_call at exactly the first index of the tail window.
    const tailCount = 20;
    const earlyCount = 15;
    const messages = [
      system("sys"),
      ...Array.from({ length: earlyCount }, (_, i) => user(`early${i}`)),
      assistantToolCall("call_B"),
      toolResult("call_B"),
      ...Array.from({ length: tailCount - 2 }, (_, i) => user(`late${i}`)),
    ];

    const result = trimMessagesKeepingToolPairs({
      messages,
      keepFirst: 1,
      tailCount,
    });

    const hasCall = result.some((m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (p) => p.type === "tool-call" && p.toolCallId === "call_B",
      ),
    );
    const hasResult = result.some((m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (p) => p.type === "tool-result" && p.toolCallId === "call_B",
      ),
    );
    expect(hasCall).toBe(true);
    expect(hasResult).toBe(true);
  });

  it("Case E: keepFirst=1 always preserves the system message at index 0", () => {
    const messages = [
      system("sys"),
      ...Array.from({ length: 40 }, (_, i) => user(`u${i}`)),
    ];
    const result = trimMessagesKeepingToolPairs({
      messages,
      keepFirst: 1,
      tailCount: 20,
    });
    expect(result[0]).toEqual(system("sys"));
  });

  it("Case F: chained tool_call -> tool_result -> assistant text -> tool_call -> tool_result is preserved end-to-end across the boundary", () => {
    // First pair straddles the boundary, second pair fully in tail.
    const messages = [
      system("sys"),
      user("u1"),
      assistantToolCall("call_P1"),
      toolResult("call_P1"),
      ...Array.from({ length: 15 }, (_, i) => user(`mid${i}`)),
      // boundary roughly here when tailCount=20, total = 23ish
      assistantText("thinking"),
      assistantToolCall("call_P2"),
      toolResult("call_P2"),
      user("uLast"),
    ];

    const result = trimMessagesKeepingToolPairs({
      messages,
      keepFirst: 1,
      tailCount: 20,
    });

    for (const id of ["call_P1", "call_P2"]) {
      const hasCall = result.some((m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === "tool-call" && p.toolCallId === id,
        ),
      );
      const hasResult = result.some((m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === "tool-result" && p.toolCallId === id,
        ),
      );
      expect(hasCall, `${id} tool_call missing`).toBe(true);
      expect(hasResult, `${id} tool_result missing`).toBe(true);
    }
  });

  it("Case G: a tool_call with multiple tool_result messages keeps the tool_call when any result lands in the tail", () => {
    // Spec allows multiple tool_result parts per call. Construct a tool_call
    // followed by two tool_result messages with the same toolCallId; the
    // second result sits in the tail, the first sits above the boundary.
    const messages = [
      system("sys"),
      user("u1"),
      assistantToolCall("call_M"),
      toolResult("call_M", "doThing", "partial"),
      ...Array.from({ length: 20 }, (_, i) => user(`mid${i}`)),
      toolResult("call_M", "doThing", "final"),
      user("uLast"),
    ];

    const result = trimMessagesKeepingToolPairs({
      messages,
      keepFirst: 1,
      tailCount: 20,
    });

    const hasCall = result.some((m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (p) => p.type === "tool-call" && p.toolCallId === "call_M",
      ),
    );
    const resultsKept = result.flatMap((m) =>
      Array.isArray(m.content)
        ? m.content.filter(
            (p) => p.type === "tool-result" && p.toolCallId === "call_M",
          )
        : [],
    );
    expect(hasCall).toBe(true);
    // At minimum the tail tool_result must be kept; the earlier one may
    // ride along once the boundary expands but must not be orphaned.
    expect(resultsKept.length).toBeGreaterThanOrEqual(1);
  });

  it("never produces an orphan tool_result (every tool_result has its tool_call in the output)", () => {
    // Property-style assertion across cases B/F/G — and a few randomised
    // shuffles to exercise edge offsets.
    const buildHistory = (seedToolCallIdxs) => {
      const out = [system("sys")];
      const callIds = [];
      for (let i = 0; i < 30; i++) {
        if (seedToolCallIdxs.includes(i)) {
          const id = `call_${i}`;
          out.push(assistantToolCall(id));
          callIds.push({ id, resultIdx: i + 1 });
        } else if (callIds.length && callIds[callIds.length - 1].resultIdx === i) {
          out.push(toolResult(callIds[callIds.length - 1].id));
        } else {
          out.push(user(`u${i}`));
        }
      }
      return out;
    };

    for (const seeds of [[2], [4, 22], [1, 8, 18, 24], [0, 5, 10, 15, 25]]) {
      const messages = buildHistory(seeds);
      const result = trimMessagesKeepingToolPairs({
        messages,
        keepFirst: 1,
        tailCount: 20,
      });
      const callIds = new Set();
      const resultIds = new Set();
      for (const m of result) {
        if (!Array.isArray(m.content)) continue;
        for (const p of m.content) {
          if (p.type === "tool-call") callIds.add(p.toolCallId);
          if (p.type === "tool-result") resultIds.add(p.toolCallId);
        }
      }
      for (const id of resultIds) {
        expect(callIds.has(id), `orphan tool_result ${id}`).toBe(true);
      }
    }
  });
});
