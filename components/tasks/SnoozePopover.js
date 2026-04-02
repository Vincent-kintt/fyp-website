"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { FaClock } from "react-icons/fa";
import { getSnoozePresets } from "@/lib/utils";

export default function SnoozePopover({ taskId, onSnooze, onClose, anchorRef }) {
  const t = useTranslations("snooze");
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const popoverRef = useRef(null);
  const innerRef = useRef(null);

  const presets = getSnoozePresets();

  // Compute position from anchor button
  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverWidth = 256; // w-64
    let left = rect.right - popoverWidth;
    if (left < 8) left = 8;
    setCoords({ top: rect.bottom + 8, left });
  }, [anchorRef]);

  // Auto-flip if overflowing viewport bottom
  useEffect(() => {
    if (!innerRef.current || !anchorRef?.current) return;
    const popRect = innerRef.current.getBoundingClientRect();
    if (popRect.bottom > window.innerHeight - 16) {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      setCoords(prev => ({ ...prev, top: anchorRect.top - popRect.height - 8 }));
    }
  }, [showCustom, anchorRef]);

  // Set default custom date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setCustomDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Click outside to close (excluding anchor button)
  useEffect(() => {
    const listener = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [onClose, anchorRef]);

  // Close on scroll (popover loses spatial relationship with anchor)
  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener("scroll", handleScroll, { capture: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [onClose]);

  const handlePresetClick = (preset) => {
    onSnooze(taskId, preset.value.toISOString());
    onClose();
  };

  const handleCustomSubmit = () => {
    if (!customDate || !customTime) return;
    const target = new Date(`${customDate}T${customTime}:00`);
    if (target <= new Date()) return;
    onSnooze(taskId, target.toISOString());
    onClose();
  };

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return createPortal(
    <div
      ref={popoverRef}
      className="z-[60]"
      style={{ position: "fixed", top: coords.top, left: coords.left }}
    >
      <div
        ref={innerRef}
        className="w-64 rounded-xl border shadow-xl overflow-hidden modal-panel-enter"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        {/* Header */}
        <div
          className="px-3 py-2 text-xs font-semibold border-b"
          style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
        >
          {t("title")}
        </div>

        {/* Preset options */}
        <div className="py-1">
          {presets.map((preset) => (
            <button
              key={preset.labelKey}
              onClick={() => handlePresetClick(preset)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-primary)" }}
            >
              <span>{t(preset.labelKey)}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {preset.sublabel}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: "var(--border)" }} />

        {/* Custom option */}
        <div className="py-1">
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-primary)" }}
          >
            <FaClock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <span>{t("customTime")}</span>
          </button>

          {showCustom && (
            <div className="px-3 pb-2 space-y-2">
              <input
                type="date"
                value={customDate}
                min={minDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-purple-500/40"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-purple-500/40"
                style={{
                  background: "var(--input-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={handleCustomSubmit}
                className="w-full py-1.5 text-sm font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
              >
                {t("confirm")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
