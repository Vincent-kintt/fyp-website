// Pair-aware trimmer for AI SDK v6 ModelMessage history.
//
// The naive `[messages[0], ...slice(-tailCount)]` cap is purely positional
// and can orphan tool messages: if a `tool_result` whose `tool_call` lives
// above the slice boundary lands in the tail, the provider receives a
// dangling `tool_result` and either rejects the request (Anthropic) or
// hallucinates (some OpenAI-compatible providers).
//
// Strategy: keep the first `keepFirst` messages, then walk forward through
// the tail collecting toolCallIds referenced by `tool-call`/`tool-result`
// parts, and expand the tail boundary upward to include any earlier message
// that holds a referenced tool_call or tool_result. Pulling extra context is
// strictly safer than dropping it — losing a few tokens of older chat is
// preferable to a provider 400.
//
// The pair-preservation rule is symmetric: a tool_call in the tail also
// pulls in its tool_result(s) wherever they sit (including any sitting
// outside the original tail window, e.g. if the upstream message order
// interleaves results across step boundaries).
//
// Pure function. No SDK imports. No I/O.
export function trimMessagesKeepingToolPairs({
  messages,
  keepFirst = 1,
  tailCount = 20,
}) {
  if (!Array.isArray(messages)) return messages;
  if (messages.length <= keepFirst + tailCount) return messages;

  const total = messages.length;
  const initialBoundary = total - tailCount;

  // Collect every toolCallId referenced by parts already inside the tail.
  // Once we know which calls the tail depends on, we must keep ALL messages
  // that hold a matching tool-call or tool-result part — wherever they sit.
  const referencedToolCallIds = new Set();
  const collectIds = (msg) => {
    if (!Array.isArray(msg?.content)) return;
    for (const part of msg.content) {
      if (
        part &&
        (part.type === "tool-call" || part.type === "tool-result") &&
        typeof part.toolCallId === "string"
      ) {
        referencedToolCallIds.add(part.toolCallId);
      }
    }
  };
  for (let i = initialBoundary; i < total; i++) {
    collectIds(messages[i]);
  }

  // A message qualifies as a "tool pair anchor" if any of its content parts
  // matches a referenced toolCallId. Such messages must be retained.
  const isToolPairAnchor = (msg) => {
    if (!Array.isArray(msg?.content)) return false;
    return msg.content.some(
      (part) =>
        part &&
        (part.type === "tool-call" || part.type === "tool-result") &&
        referencedToolCallIds.has(part.toolCallId),
    );
  };

  // Walk the early-window messages (between keepFirst and the initial
  // boundary) and mark indices we need to retain. Use a Set for membership;
  // we'll emit messages in original order at the end.
  const retainedEarly = new Set();
  for (let i = keepFirst; i < initialBoundary; i++) {
    if (isToolPairAnchor(messages[i])) {
      retainedEarly.add(i);
    }
  }

  // Build the output: first `keepFirst` messages, then any early indices
  // dragged in by tool pairs (in original order), then the full tail.
  const head = messages.slice(0, keepFirst);
  const expandedEarly = [];
  for (let i = keepFirst; i < initialBoundary; i++) {
    if (retainedEarly.has(i)) expandedEarly.push(messages[i]);
  }
  const tail = messages.slice(initialBoundary);
  return [...head, ...expandedEarly, ...tail];
}
