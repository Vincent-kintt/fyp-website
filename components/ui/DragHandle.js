"use client";

export default function DragHandle({ listeners, attributes }) {
  return (
    <button
      {...listeners}
      {...attributes}
      className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
      style={{ color: "var(--text-muted)" }}
      aria-label="Drag to reorder"
    >
      <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
        <circle cx="3" cy="3" r="1.5" />
        <circle cx="9" cy="3" r="1.5" />
        <circle cx="3" cy="9" r="1.5" />
        <circle cx="9" cy="9" r="1.5" />
        <circle cx="3" cy="15" r="1.5" />
        <circle cx="9" cy="15" r="1.5" />
      </svg>
    </button>
  );
}
