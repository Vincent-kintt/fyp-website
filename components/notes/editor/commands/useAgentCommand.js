// useAgentCommand — hook that owns the agentic UI-message-stream branch of
// the AI dispatcher (POST /api/ai/notes-agentic for the /agent command).
//
// Uses createAgenticStreamParser (PR2a) to interpret tool-input/tool-output/
// text-delta chunks, and finalizeAiResponse (PR2b) to commit the parsed
// markdown + side-effect labels into the editor.
//
// executeAgentCommand is exported separately for unit testing without React.

import { useCallback } from "react";
import {
  parseJsonEventStream,
  consumeStream,
  uiMessageChunkSchema,
} from "ai";
import { blocksToText } from "@/lib/notes/blocksToText.js";
import { stripStreamingMarkdown } from "@/lib/notes/streamMarkdownStrip.js";
import { createAgenticStreamParser } from "@/lib/notes/parseAgenticStream.js";
import { finalizeAiResponse } from "@/components/notes/editor/commands/finalizeAiResponse.js";

export async function executeAgentCommand(editor, ctx, input, commandBlockId) {
  const { titleRef, localeRef, t, executedCommandsRef, toolProgressLabels } = ctx;
  const noteContext = blocksToText(editor.document);
  const commandBlock = commandBlockId
    ? editor.getBlock(commandBlockId)
    : editor.getTextCursorPosition().block;

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
    const res = await fetch("/api/ai/notes-agentic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
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

    const parser = createAgenticStreamParser();
    let aborted = false;

    await consumeStream({
      stream: parseJsonEventStream({
        stream: res.body,
        schema: uiMessageChunkSchema,
      }).pipeThrough(
        new TransformStream({
          transform(part) {
            if (aborted || !part.success) return;
            const evt = parser.feed(part.value);
            if (!evt) return;

            if (evt.type === "tool-input") {
              const labelKey = toolProgressLabels[evt.toolName];
              if (labelKey) {
                try {
                  editor.updateBlock(loadingBlock, {
                    type: "paragraph",
                    content: t(labelKey),
                  });
                } catch {
                  aborted = true;
                }
              }
            } else if (evt.type === "text") {
              try {
                editor.updateBlock(loadingBlock, {
                  type: "paragraph",
                  content: stripStreamingMarkdown(evt.accumulated),
                });
              } catch {
                aborted = true;
              }
            }
          },
        }),
      ),
    });

    const accumulatedText = parser.getAccumulated();
    const sideEffects = parser.getSideEffects();

    await finalizeAiResponse(editor, {
      loadingBlock,
      commandBlock,
      accumulated: accumulatedText,
      sideEffects,
      t,
    });
  } catch (err) {
    console.error("Agent command error:", err);
    // Allow retry by clearing the consumed tracking for this block
    executedCommandsRef.current.delete(commandBlock.id);
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

export function useAgentCommand({
  editor,
  titleRef,
  localeRef,
  t,
  executedCommandsRef,
  toolProgressLabels,
}) {
  return useCallback(
    (input, commandBlockId) =>
      executeAgentCommand(
        editor,
        { titleRef, localeRef, t, executedCommandsRef, toolProgressLabels },
        input,
        commandBlockId,
      ),
    [editor, t, titleRef, localeRef, executedCommandsRef, toolProgressLabels],
  );
}
