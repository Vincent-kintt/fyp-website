"use client";

import { useTranslations } from "next-intl";
import MessageBubble from "./MessageBubble";
import EmptyState from "./EmptyState";
import StreamingIndicator from "./StreamingIndicator";

export default function MessageList({
  messages,
  isProcessing,
  initialText,
  language,
  onSelectPrompt,
  messagesEndRef,
}) {
  const t = useTranslations("aiModal");
  const lastMsg = messages[messages.length - 1];
  const showStreamingIndicator =
    isProcessing &&
    !(lastMsg?.role === "assistant" && lastMsg.parts?.length > 0);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {initialText && messages.length <= 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 10px",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "6px",
            alignSelf: "flex-start",
            marginBottom: "4px",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--modal-text-muted)" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span style={{ fontSize: "10px", color: "var(--modal-text-muted)" }}>
            {t("continuedFromQuickAdd")}
          </span>
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyState language={language} onSelectPrompt={onSelectPrompt} />
      ) : (
        <>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} language={language} />
          ))}
          {showStreamingIndicator && <StreamingIndicator />}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
