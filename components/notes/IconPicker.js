"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Search, X } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  ICON_CATEGORIES,
  ICON_COLOR_NAMES,
  getIconComponent,
  getIconColor,
} from "@/lib/notes/iconMap";

export default function IconPicker({ currentIcon, onSelect, onClose }) {
  const t = useTranslations("notes");
  const { resolvedTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [selectedColor, setSelectedColor] = useState(
    currentIcon?.color || "gray",
  );
  const searchRef = useRef(null);
  const pickerRef = useClickOutside(onClose);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const query = search.toLowerCase().trim();

  return (
    <div className="notes-icon-picker" ref={pickerRef}>
      <div className="notes-icon-picker-search">
        <Search size={14} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
        <input
          ref={searchRef}
          type="text"
          placeholder={t("searchIcons")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="notes-icon-picker-colors">
        {ICON_COLOR_NAMES.map((color) => (
          <button
            key={color}
            className="notes-icon-picker-color"
            data-selected={color === selectedColor}
            style={{ backgroundColor: getIconColor(color, resolvedTheme) }}
            onClick={() => setSelectedColor(color)}
            aria-label={color.charAt(0).toUpperCase() + color.slice(1)}
          />
        ))}
      </div>

      <button className="notes-icon-picker-remove" onClick={() => onSelect(null)}>
        <X size={14} />
        {t("removeIcon")}
      </button>

      <div className="notes-icon-picker-grid-wrapper">
        {Object.entries(ICON_CATEGORIES).map(([category, icons]) => {
          const filtered = query
            ? icons.filter((name) => name.includes(query))
            : icons;
          if (filtered.length === 0) return null;

          const label = `icon${category.charAt(0).toUpperCase() + category.slice(1)}`;

          return (
            <div key={category}>
              <div className="notes-icon-picker-category">{t(label)}</div>
              <div className="notes-icon-picker-grid">
                {filtered.map((name) => {
                  const Icon = getIconComponent(name);
                  const isSelected =
                    currentIcon?.name === name &&
                    currentIcon?.color === selectedColor;

                  return (
                    <button
                      key={name}
                      className="notes-icon-picker-icon"
                      data-selected={isSelected}
                      onClick={() => onSelect({ name, color: selectedColor })}
                    >
                      <Icon
                        size={18}
                        color={getIconColor(selectedColor, resolvedTheme)}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
