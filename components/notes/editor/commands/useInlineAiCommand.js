// useInlineAiCommand — hook that owns the raw text-stream branch of the
// inline AI dispatcher (POST /api/ai/notes-agent for /ask /summarize /digest).
//
// executeInlineAiCommand is exported separately to keep it unit-testable
// without React's hook machinery; useInlineAiCommand is a thin useCallback
// wrapper that closes over the latest opts.

import { useCallback } from "react";
import { blocksToText } from "@/lib/notes/blocksToText.js";
import { stripStreamingMarkdown } from "@/lib/notes/streamMarkdownStrip.js";
import { finalizeAiResponse } from "@/components/notes/editor/commands/finalizeAiResponse.js";

export async function executeInlineAiCommand(editor, ctx, type, input, commandBlockId) {
  const { titleRef, localeRef, t, executedCommandsRef } = ctx;
  const noteContext = blocksToText(editor.document);

  let commandBlock;
  if (commandBlockId) {
    commandBlock = editor.getBlock(commandBlockId);
  } else {
    commandBlock = editor.getTextCursorPosition().block;
  }
  if (!commandBlock) return;

  const blockText =
    commandBlock.content?.map((c) => c.text || "").join("") || "";
  executedCommandsRef.current.set(commandBlock.id, blockText);

  const [loadingBlock] = editor.insertBlocks(
    [{ type: "paragraph", content: t("aiGenerating") }],
    commandBlock,
    "after",
  );

  try {
    const res = await fetch("/api/ai/notes-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: type,
        input: input || noteContext,
        noteTitle: titleRef.current,
        noteContext,
        language: localeRef.current?.startsWith("zh") ? "zh" : "en",
      }),
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg = errBody.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      try {
        editor.updateBlock(loadingBlock, {
          type: "paragraph",
          content: stripStreamingMarkdown(accumulated),
        });
      } catch {
        // Block was deleted by user mid-stream — abort
        reader.cancel();
        return;
      }
    }
    accumulated += decoder.decode(); // flush buffered multi-byte sequences

    await finalizeAiResponse(editor, {
      loadingBlock,
      commandBlock,
      accumulated,
      t,
    });
  } catch (err) {
    console.error("Inline AI error:", err);
    try {
      editor.updateBlock(loadingBlock, {
        type: "paragraph",
        content: `${t("aiError")}${err?.message ? ` — ${err.message}` : ""}`,
      });
    } catch {
      // Loading block already deleted
    }
  }
}

export function useInlineAiCommand({
  editor,
  titleRef,
  localeRef,
  t,
  executedCommandsRef,
}) {
  return useCallback(
    (type, input, commandBlockId) =>
      executeInlineAiCommand(
        editor,
        { titleRef, localeRef, t, executedCommandsRef },
        type,
        input,
        commandBlockId,
      ),
    [editor, t, titleRef, localeRef, executedCommandsRef],
  );
}
