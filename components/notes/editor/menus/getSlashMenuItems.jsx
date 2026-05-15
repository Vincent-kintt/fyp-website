import { Sparkles, Bot, Rss } from "lucide-react";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";

const aiIconStyle = { color: "var(--accent)" };

export function getSlashMenuItems({
  editorInstance,
  t,
  executeAiCommand,
  disableAiCommands = false,
}) {
  const defaultItems = getDefaultReactSlashMenuItems(editorInstance);

  if (disableAiCommands) return defaultItems;

  const aiItems = [
    {
      title: t("askAi"),
      onItemClick: () => {
        const currentBlock = editorInstance.getTextCursorPosition().block;
        const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
        if (!blockText.trim()) {
          editorInstance.updateBlock(currentBlock, {
            type: "paragraph",
            content: "/ask ",
          });
          editorInstance.setTextCursorPosition(currentBlock, "end");
        } else {
          const [newBlock] = editorInstance.insertBlocks(
            [{ type: "paragraph", content: "/ask " }],
            currentBlock,
            "after",
          );
          editorInstance.setTextCursorPosition(newBlock, "end");
        }
      },
      subtext: t("askAiSubtext"),
      aliases: ["ask", "ai"],
      group: "AI",
      icon: <Sparkles size={14} strokeWidth={1.5} style={aiIconStyle} />,
    },
    {
      title: t("summarize"),
      onItemClick: () => {
        const currentBlock = editorInstance.getTextCursorPosition().block;
        const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
        if (!blockText.trim()) {
          editorInstance.updateBlock(currentBlock, {
            type: "paragraph",
            content: "/summarize",
          });
          executeAiCommand("summarize", "", currentBlock.id);
        } else {
          const [newBlock] = editorInstance.insertBlocks(
            [{ type: "paragraph", content: "/summarize" }],
            currentBlock,
            "after",
          );
          executeAiCommand("summarize", "", newBlock.id);
        }
      },
      subtext: t("summarizeSubtext"),
      aliases: ["summarize", "summary"],
      group: "AI",
      icon: <Sparkles size={14} strokeWidth={1.5} style={aiIconStyle} />,
    },
    {
      title: t("digestLabel"),
      onItemClick: () => {
        const currentBlock = editorInstance.getTextCursorPosition().block;
        const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
        if (!blockText.trim()) {
          editorInstance.updateBlock(currentBlock, {
            type: "paragraph",
            content: "/digest",
          });
          executeAiCommand("digest", "", currentBlock.id);
        } else {
          const [newBlock] = editorInstance.insertBlocks(
            [{ type: "paragraph", content: "/digest" }],
            currentBlock,
            "after",
          );
          executeAiCommand("digest", "", newBlock.id);
        }
      },
      subtext: t("digestSubtext"),
      aliases: ["digest"],
      group: "AI",
      icon: <Sparkles size={14} strokeWidth={1.5} style={aiIconStyle} />,
    },
    {
      title: t("agent"),
      onItemClick: () => {
        const currentBlock = editorInstance.getTextCursorPosition().block;
        const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
        if (!blockText.trim()) {
          editorInstance.updateBlock(currentBlock, {
            type: "paragraph",
            content: "/agent ",
          });
          editorInstance.setTextCursorPosition(currentBlock, "end");
        } else {
          const [newBlock] = editorInstance.insertBlocks(
            [{ type: "paragraph", content: "/agent " }],
            currentBlock,
            "after",
          );
          editorInstance.setTextCursorPosition(newBlock, "end");
        }
      },
      subtext: t("agentSubtext"),
      aliases: ["agent"],
      group: "AI",
      icon: <Bot size={14} strokeWidth={1.5} style={aiIconStyle} />,
    },
    {
      title: t("rss"),
      onItemClick: () => {
        const currentBlock = editorInstance.getTextCursorPosition().block;
        const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
        if (!blockText.trim()) {
          editorInstance.updateBlock(currentBlock, {
            type: "paragraph",
            content: "/rss today",
          });
          executeAiCommand("rss", "today", currentBlock.id);
        } else {
          const [newBlock] = editorInstance.insertBlocks(
            [{ type: "paragraph", content: "/rss today" }],
            currentBlock,
            "after",
          );
          executeAiCommand("rss", "today", newBlock.id);
        }
      },
      subtext: t("rssSubtext"),
      aliases: ["rss", "news", "feed"],
      group: "AI",
      icon: <Rss size={14} strokeWidth={1.5} style={aiIconStyle} />,
    },
  ];

  return [...defaultItems, ...aiItems];
}
