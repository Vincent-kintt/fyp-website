// useRssCommand — hook that owns the /rss command: subscription precheck via
// GET /api/rss, onboarding modal gate when no subscriptions, and the
// streaming POST /api/ai/notes-rss path.
//
// onNeedOnboarding(subscribeAndRetry) is called when GET /api/rss returns an
// empty subscription list. The caller is expected to open its RSS-onboarding
// modal and, when the user picks categories, invoke
// subscribeAndRetry(categories) — that helper POSTs /api/rss to subscribe and
// then runs the streaming fetch against the (now non-empty) subscriptions.
//
// executeRssCommand is exported separately for unit testing without React.

import { useCallback } from "react";
import {
  parseJsonEventStream,
  consumeStream,
  uiMessageChunkSchema,
} from "ai";
import { stripStreamingMarkdown } from "@/lib/notes/streamMarkdownStrip.js";
import { createAgenticStreamParser } from "@/lib/notes/parseAgenticStream.js";
import { finalizeAiResponse } from "@/components/notes/editor/commands/finalizeAiResponse.js";

async function runRssStream(editor, ctx, commandBlock) {
  const { localeRef, t, executedCommandsRef, toolProgressLabels } = ctx;

  const [loadingBlock] = editor.insertBlocks(
    [{ type: "paragraph", content: t("rssLoadingSubscriptions") }],
    commandBlock,
    "after",
  );

  try {
    const res = await fetch("/api/ai/notes-rss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: localeRef.current?.startsWith("zh") ? "zh" : "en",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

    await finalizeAiResponse(editor, {
      loadingBlock,
      commandBlock,
      accumulated: accumulatedText,
      t,
    });
  } catch (err) {
    console.error("RSS fetch error:", err);
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

export async function executeRssCommand(editor, ctx, commandBlockId) {
  const { executedCommandsRef, onNeedOnboarding } = ctx;

  const commandBlock = commandBlockId
    ? editor.getBlock(commandBlockId)
    : editor.getTextCursorPosition().block;

  if (!commandBlock) return;

  const blockText =
    commandBlock.content?.map((c) => c.text || "").join("") || "";
  executedCommandsRef.current.set(commandBlock.id, blockText);

  try {
    const checkRes = await fetch("/api/rss");
    if (!checkRes.ok) throw new Error(`HTTP ${checkRes.status}`);
    const checkBody = await checkRes.json();

    if (!checkBody.data || checkBody.data.length === 0) {
      const subscribeAndRetry = async (categories) => {
        const subRes = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories }),
        });
        if (!subRes.ok) throw new Error("Failed to subscribe");
        await runRssStream(editor, ctx, commandBlock);
      };
      onNeedOnboarding(subscribeAndRetry);
      return;
    }

    await runRssStream(editor, ctx, commandBlock);
  } catch (err) {
    console.error("RSS command error:", err);
    executedCommandsRef.current.delete(commandBlock.id);
  }
}

export function useRssCommand({
  editor,
  localeRef,
  t,
  executedCommandsRef,
  toolProgressLabels,
  onNeedOnboarding,
}) {
  return useCallback(
    (commandBlockId) =>
      executeRssCommand(
        editor,
        {
          localeRef,
          t,
          executedCommandsRef,
          toolProgressLabels,
          onNeedOnboarding,
        },
        commandBlockId,
      ),
    [editor, t, localeRef, executedCommandsRef, toolProgressLabels, onNeedOnboarding],
  );
}
