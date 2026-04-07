"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatHourLabel } from "@/lib/calendar";

/**
 * QuickAddPopover — inline popover for adding a task at a specific time slot.
 *
 * @param {Object} props
 * @param {string} props.dateStr           — "YYYY-MM-DD"
 * @param {number} props.hour              — 0–23
 * @param {number} [props.minute=0]        — 0–59
 * @param {({title, dateTime}) => void} props.onSubmit
 * @param {({title, dateTime}) => void} props.onMoreOptions
 * @param {() => void} props.onClose
 * @param {string} [props.locale]          — "zh-TW" | "en"
 */
export default function QuickAddPopover({
  dateStr,
  hour,
  minute = 0,
  onSubmit,
  onMoreOptions,
  onClose,
  locale,
}) {
  const t = useTranslations("calendar");
  const [title, setTitle] = useState("");
  const inputRef = useRef(null);

  const hourStr = String(hour).padStart(2, "0");
  const minuteStr = String(minute).padStart(2, "0");
  const dateTime = `${dateStr}T${hourStr}:${minuteStr}`;
  const timeLabel = formatHourLabel(hour, locale);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit?.({ title: title.trim(), dateTime });
    onClose?.();
  }

  function handleMoreOptions() {
    onMoreOptions?.({ title: title.trim(), dateTime });
    onClose?.();
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
    }
  }

  return (
    <div
      className="absolute z-30 rounded-xl shadow-xl border p-3 flex flex-col gap-2"
      style={{
        width: "256px",
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Time label */}
      <span
        className="text-xs font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {timeLabel}
      </span>

      {/* Input */}
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("quickAddPlaceholder")}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none border"
          style={{
            backgroundColor: "var(--background)",
            borderColor: "var(--card-border)",
            color: "var(--text-primary)",
          }}
        />
      </form>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleMoreOptions}
          className="text-xs transition-colors hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("moreOptions")}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40"
          style={{
            backgroundColor: "var(--accent)",
            color: "#ffffff",
          }}
        >
          {t("addTask")}
        </button>
      </div>
    </div>
  );
}
