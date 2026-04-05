"use client";

import { useMemo, useState, useEffect } from "react";
import { useFloating, offset, flip, shift, autoUpdate } from "@floating-ui/react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { FaMagic } from "react-icons/fa";

export default function FloatingSuggestion({ suggestion, onAdd, onDismiss }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const anchorEl = useMemo(() => {
    if (!mounted || !suggestion?.paragraphId) return null;
    return document.querySelector(
      `[data-id="${suggestion.paragraphId}"]`
    );
  }, [mounted, suggestion?.paragraphId]);

  const { refs, floatingStyles } = useFloating({
    elements: { reference: anchorEl },
    placement: "bottom-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: anchorEl ? autoUpdate : undefined,
  });

  if (!mounted || !suggestion || !anchorEl) return null;

  const { result } = suggestion;
  const parts = [];
  if (result.title) parts.push(result.title);
  if (result.dateTime) {
    const d = new Date(result.dateTime);
    parts.push(
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );
    if (d.getHours() || d.getMinutes()) {
      parts.push(
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
    }
  }

  return createPortal(
    <div
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        color: "var(--primary)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] z-50"
    >
      <FaMagic size={12} className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate max-w-[280px]">{parts.join(" · ")}</span>
      <button
        onClick={onAdd}
        className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
        style={{
          backgroundColor: "var(--primary-light)",
          color: "var(--primary)",
        }}
      >
        Add
      </button>
      <button
        onClick={onDismiss}
        className="p-0.5 rounded transition-colors hover:opacity-70"
        aria-label="Dismiss"
        style={{ color: "var(--text-muted)" }}
      >
        <FiX size={12} />
      </button>
    </div>,
    document.body
  );
}
