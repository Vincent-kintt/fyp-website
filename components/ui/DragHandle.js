"use client";

import { memo } from "react";

export default memo(function DragHandle({ listeners, attributes }) {
  return (
    <button
      {...listeners}
      {...attributes}
      className="touch-none cursor-grab active:cursor-grabbing rounded flex-shrink-0
                 p-1 -ml-1
                 sm:absolute sm:top-4 sm:-left-8 sm:w-6 sm:h-6 sm:m-0 sm:p-0
                 sm:flex sm:items-center sm:justify-center
                 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity sm:duration-200"
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
});
