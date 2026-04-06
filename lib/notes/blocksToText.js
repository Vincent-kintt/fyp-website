/**
 * Convert BlockNote blocks to plain text.
 * Recursively walks the block tree, concatenating inline text content.
 * Does NOT truncate — returns the full text for AI processing.
 */
export function blocksToText(blocks) {
  if (!blocks || !Array.isArray(blocks)) return "";

  const lines = [];

  for (const block of blocks) {
    // Extract inline text from this block's content array
    if (block.content && Array.isArray(block.content)) {
      const inlineText = block.content
        .map((inline) => (inline.type === "text" && inline.text) || "")
        .join("");
      if (inlineText) {
        lines.push(inlineText);
      }
    }

    // Recurse into nested children (sub-blocks, e.g., list items)
    if (block.children && Array.isArray(block.children)) {
      const childText = blocksToText(block.children);
      if (childText) {
        lines.push(childText);
      }
    }
  }

  return lines.join("\n");
}
