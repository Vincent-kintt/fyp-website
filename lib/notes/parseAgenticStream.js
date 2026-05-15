export function createAgenticStreamParser() {
  let accumulated = "";
  const sideEffects = [];
  const toolNamesByCallId = new Map();

  return {
    feed(chunk) {
      if (!chunk || typeof chunk !== "object") return null;
      const { type } = chunk;

      if (type === "text-delta") {
        if (typeof chunk.delta !== "string") return null;
        accumulated += chunk.delta;
        return { type: "text", accumulated };
      }

      if (type === "tool-input-available") {
        if (
          typeof chunk.toolCallId === "string" &&
          typeof chunk.toolName === "string"
        ) {
          toolNamesByCallId.set(chunk.toolCallId, chunk.toolName);
        }
        return { type: "tool-input", toolName: chunk.toolName };
      }

      if (type === "tool-output-available") {
        const toolName = toolNamesByCallId.get(chunk.toolCallId);
        if (toolName === "createReminder") {
          let output = chunk.output;
          if (typeof output === "string") {
            try {
              output = JSON.parse(output);
            } catch {
              output = null;
            }
          }
          if (output?.success && output?.reminder) {
            sideEffects.push({
              tool: "createReminder",
              title: output.reminder.title,
              dateTime: output.reminder.dateTime,
            });
          }
        }
        return { type: "tool-output", toolName };
      }

      return null;
    },

    getAccumulated() {
      return accumulated;
    },

    getSideEffects() {
      return sideEffects.map((effect) => ({ ...effect }));
    },
  };
}
