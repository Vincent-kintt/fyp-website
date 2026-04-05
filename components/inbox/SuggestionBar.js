"use client";

import { FiX } from "react-icons/fi";
import { FaMagic } from "react-icons/fa";

export default function SuggestionBar({ result, onAdd, onDismiss }) {
  const parts = [];
  if (result.title) parts.push(result.title);
  if (result.dateTime) {
    const d = new Date(result.dateTime);
    parts.push(
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );
    const hours = d.getHours();
    const mins = d.getMinutes();
    if (hours || mins) {
      parts.push(
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
    }
  }

  return (
    <div
      className="mt-2 mx-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
      style={{
        backgroundColor: "var(--primary-light)",
        border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
        color: "var(--primary)",
      }}
    >
      <FaMagic size={12} className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{parts.join(" · ")}</span>
      <button
        onClick={onAdd}
        className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
        }}
      >
        Add
      </button>
      <button
        onClick={onDismiss}
        className="p-0.5 rounded transition-colors hover:opacity-70"
        aria-label="Dismiss"
      >
        <FiX size={12} />
      </button>
    </div>
  );
}
