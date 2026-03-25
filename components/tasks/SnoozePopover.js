"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FaClock } from "react-icons/fa";
import { useClickOutside } from "@/hooks/useClickOutside";
import { getSnoozePresets } from "@/lib/utils";

export default function SnoozePopover({ taskId, onSnooze, onClose }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [flipUp, setFlipUp] = useState(false);
  const popoverRef = useClickOutside(useCallback(() => onClose(), [onClose]));
  const innerRef = useRef(null);

  const presets = getSnoozePresets();

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

  // Auto-flip if overflowing viewport bottom
  useEffect(() => {
    if (innerRef.current) {
      const rect = innerRef.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 16) {
        setFlipUp(true);
      }
    }
  }, [showCustom]);

  const handlePresetClick = (preset) => {
    onSnooze(taskId, preset.value.toISOString());
    onClose();
  };

  const handleCustomSubmit = () => {
    if (!customDate || !customTime) return;
    const target = new Date(`${customDate}T${customTime}:00`);
    if (target <= new Date()) return; // don't allow past times
    onSnooze(taskId, target.toISOString());
    onClose();
  };

  // Min date for custom picker = today
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div
      ref={popoverRef}
      className={`absolute right-0 z-40 ${flipUp ? "bottom-full mb-2" : "top-full mt-2"}`}
    >
      <div
        ref={innerRef}
        className="w-64 rounded-xl border shadow-xl overflow-hidden"
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
          延後提醒
        </div>

        {/* Preset options */}
        <div className="py-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-primary)" }}
            >
              <span>{preset.label}</span>
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
            <span>自訂時間...</span>
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
                確認
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
