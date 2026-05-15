export async function finalizeAiResponse(editor, opts) {
  const {
    loadingBlock,
    commandBlock,
    accumulated,
    sideEffects = [],
    t,
    errorKey = "aiError",
    sideEffectLabelKey = "agentSideEffect",
  } = opts;

  if (!accumulated || !accumulated.trim()) {
    try {
      editor.updateBlock(loadingBlock, {
        type: "paragraph",
        content: t(errorKey),
      });
    } catch {
      // loadingBlock already deleted by the user mid-stream — nothing to update
    }
    return;
  }

  const parsedBlocks = editor.tryParseMarkdownToBlocks(accumulated);

  if (editor.getBlock(loadingBlock.id)) {
    editor.removeBlocks([loadingBlock]);
  }

  if (parsedBlocks.length === 0 || !editor.getBlock(commandBlock.id)) {
    return;
  }

  const insertedBlocks = editor.insertBlocks(parsedBlocks, commandBlock, "after");

  if (sideEffects.length === 0) return;

  const lastBlock = insertedBlocks[insertedBlocks.length - 1];
  for (const effect of sideEffects) {
    const dateSuffix = effect.dateTime ? ` (${effect.dateTime})` : "";
    const label = `${t(sideEffectLabelKey)} ${effect.title}${dateSuffix}`;
    editor.insertBlocks(
      [
        {
          type: "paragraph",
          content: [
            { type: "text", text: label, styles: { italic: true } },
          ],
        },
      ],
      lastBlock,
      "after",
    );
  }
}
