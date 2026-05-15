"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReasoningBlock from "./ReasoningBlock";
import ToolInvocationBlock from "./ToolInvocationBlock";
import { isToolPart } from "./toolHelpers";

export default function MessageBubble({ msg, language }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {msg.role === "user" ? (
        /* User message — right aligned chip */
        <div
          style={{
            alignSelf: "flex-end",
            maxWidth: "75%",
            padding: "9px 14px",
            background: "var(--user-bubble-bg)",
            border: "1px solid var(--user-bubble-border)",
            borderRadius: "12px 12px 4px 12px",
            fontSize: "13px",
            color: "var(--modal-text)",
          }}
        >
          {msg.parts?.map((part, i) =>
            part.type === "text" ? (
              <span key={i}>{part.text}</span>
            ) : null,
          )}
        </div>
      ) : (
        /* Assistant message — flat layout, no bubble */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignSelf: "flex-start",
            maxWidth: "88%",
            width: "100%",
          }}
        >
          {msg.parts?.map((part, pIdx) => {
            if (part.type === "step-start") {
              return null;
            }

            if (part.type === "reasoning") {
              return (
                <ReasoningBlock
                  key={`reasoning-${pIdx}`}
                  text={part.text}
                  isStreaming={part.state === "streaming"}
                />
              );
            }

            if (isToolPart(part)) {
              return (
                <ToolInvocationBlock
                  key={`tool-${pIdx}`}
                  part={part}
                  language={language}
                />
              );
            }

            if (part.type === "text") {
              const cleanContent = (part.text || "").trim();
              if (!cleanContent) return null;

              return (
                <div
                  key={`content-${pIdx}`}
                  className="markdown-content"
                  style={{
                    padding: "2px 0 2px 4px",
                    fontSize: "13px",
                    color: "var(--modal-text-secondary)",
                    lineHeight: "1.7",
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {cleanContent}
                  </ReactMarkdown>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}
