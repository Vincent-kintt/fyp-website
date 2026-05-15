"use client";

import { useState } from "react";
import NoteIcon from "./NoteIcon";
import IconPicker from "./IconPicker";

export default function NoteHeader({ note, title, onTitleChange, onIconChange, t }) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  return (
    <>
      <div className="relative" style={{ paddingLeft: "54px" }}>
        {note?.icon ? (
          <button
            onClick={() => setIconPickerOpen((prev) => !prev)}
            className="p-1 rounded-md mb-1 transition-opacity hover:opacity-80"
            style={{ cursor: "pointer" }}
          >
            <NoteIcon icon={note.icon} hasChildren={false} expanded={false} size={32} />
          </button>
        ) : (
          <button
            onClick={() => setIconPickerOpen((prev) => !prev)}
            className="notes-add-icon-hint flex items-center gap-1.5 px-2 py-1 rounded-md mb-1 text-xs"
          >
            <NoteIcon icon={null} hasChildren={false} expanded={false} size={14} fallbackOpacity={0.4} />
            {t("addIcon")}
          </button>
        )}
        {iconPickerOpen && (
          <IconPicker
            currentIcon={note?.icon}
            onSelect={(icon) => {
              onIconChange?.(icon);
              setIconPickerOpen(false);
            }}
            onClose={() => setIconPickerOpen(false)}
          />
        )}
      </div>

      <input
        className="notes-title-input mb-4"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={t("untitled")}
        aria-label="Page title"
      />
    </>
  );
}
