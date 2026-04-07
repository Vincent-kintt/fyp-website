const COMMANDS = new Set(["ask", "summarize", "digest", "agent", "rss"]);

export function parseCommand(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIndex = trimmed.indexOf(" ");
  const command =
    spaceIndex === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIndex);

  if (!COMMANDS.has(command)) return null;

  const input = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1).trim();
  return { type: command, input };
}
