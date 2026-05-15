"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { FaSpinner, FaChevronDown, FaChevronUp } from "react-icons/fa";

// Collapsible reasoning block
export default function ReasoningBlock({ text, isStreaming }) {
  const t = useTranslations("aiModal");
  const [expanded, setExpanded] = useState(isStreaming);

  // Auto-collapse when streaming finishes
  useEffect(() => {
    if (!isStreaming && text) {
      setExpanded(false);
    }
  }, [isStreaming, text]);

  if (!text) return null;

  const label = t("reasoning");

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "none",
          border: "none",
          color: "var(--modal-text-muted)",
          fontSize: "12px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {expanded ? (
          <FaChevronUp style={{ fontSize: "10px" }} />
        ) : (
          <FaChevronDown style={{ fontSize: "10px" }} />
        )}
        <span style={{ fontWeight: "500" }}>{label}</span>
        {isStreaming && (
          <FaSpinner
            className="animate-spin"
            style={{ fontSize: "10px", marginLeft: "auto" }}
          />
        )}
      </button>
      {expanded && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--glass-border)",
            fontSize: "12px",
            color: "var(--modal-text-muted)",
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
