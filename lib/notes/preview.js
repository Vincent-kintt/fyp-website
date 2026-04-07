/**
 * Extract plain text preview from BlockNote content array.
 * Walks the block tree and concatenates text nodes.
 */
export function extractPreview(content, maxLength = 80) {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return "";
  }

  const blockTexts = [];

  for (const block of content) {
    if (!block.content || !Array.isArray(block.content)) continue;
    const inlineTexts = [];
    for (const inline of block.content) {
      if (inline.type === "text" && inline.text) {
        inlineTexts.push(inline.text);
      }
      if (inline.type === "noteLink") {
        inlineTexts.push("[note]");
      }
    }
    if (inlineTexts.length > 0) {
      blockTexts.push(inlineTexts.join(""));
    }
  }

  const joined = blockTexts.join(" ").trim();

  if (joined.length <= maxLength) return joined;
  return joined.slice(0, maxLength) + "...";
}
