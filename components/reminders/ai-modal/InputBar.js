"use client";

import { useTranslations } from "next-intl";

export default function InputBar({
  input,
  setInput,
  onSend,
  isProcessing,
  errorMessage,
  suggestions,
  hasMessages,
}) {
  const t = useTranslations("aiModal");

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      style={{
        padding: "10px 14px",
        borderTop: "1px solid var(--glass-border)",
      }}
    >
      {errorMessage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#ef4444",
            background: "var(--tool-error-bg)",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--tool-error-border)",
            marginBottom: "8px",
          }}
        >
          <span>{errorMessage}</span>
        </div>
      )}
      {/* Suggested follow-ups — ghost buttons */}
      {!isProcessing && hasMessages && suggestions.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "5px",
            marginBottom: "8px",
            overflowX: "auto",
            paddingBottom: "2px",
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setInput(s.prompt)}
              style={{
                padding: "5px 11px",
                borderRadius: "6px",
                fontSize: "11px",
                background: "transparent",
                color: "var(--modal-text-muted)",
                border: "1px solid var(--glass-border)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.12s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--glass-bg)";
                e.currentTarget.style.borderColor = "var(--glass-border-hover)";
                e.currentTarget.style.color = "var(--modal-text-secondary)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "var(--glass-border)";
                e.currentTarget.style.color = "var(--modal-text-muted)";
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <textarea
          data-testid="ai-modal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={
            isProcessing ? t("placeholderWaiting") : t("placeholderInput")
          }
          rows="2"
          maxLength={2000}
          disabled={isProcessing}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: "var(--modal-input-bg)",
            border: "1px solid var(--modal-input-border)",
            borderRadius: "10px",
            color: isProcessing ? "var(--modal-text-muted)" : "var(--modal-text)",
            fontSize: "13px",
            outline: "none",
            transition: "border-color 0.15s",
            fontFamily: "inherit",
            resize: "none",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--modal-input-focus-border)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--modal-input-border)";
          }}
        />
        {isProcessing ? (
          <button
            onClick={() => {/* stop is handled by useChat */}}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "var(--glass-bg)",
              color: "var(--modal-text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!input.trim()}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: input.trim() ? "var(--modal-text)" : "var(--glass-bg)",
              color: input.trim() ? "var(--modal-bg)" : "var(--modal-text-muted)",
              cursor: input.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.12s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
