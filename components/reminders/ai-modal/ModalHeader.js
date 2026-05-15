"use client";

import { useTranslations } from "next-intl";
import { FaTimes, FaTrash, FaChevronDown } from "react-icons/fa";
import { modelOptions } from "./modelOptions";
import ModelDropdown from "./ModelDropdown";
import SettingsPopover from "./SettingsPopover";

const HEADER_BTN_STYLE = {
  width: "28px",
  height: "28px",
  borderRadius: "6px",
  border: "none",
  background: "transparent",
  color: "var(--modal-text-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "color 0.12s, background 0.12s",
};

export default function ModalHeader({
  isMobile,
  settings,
  onSettingsChange,
  showModelDropdown,
  setShowModelDropdown,
  showSettings,
  setShowSettings,
  supportsReasoning,
  supportsReasoningToggle,
  hasMessages,
  onClearChat,
  onClose,
}) {
  const t = useTranslations("aiModal");
  const currentModelLabel =
    modelOptions.find((o) => o.value === settings.model)?.label || "Model";

  return (
    <div
      className={`modal-header flex items-center ${isMobile ? "" : "cursor-move"} select-none`}
      style={{
        padding: "0 14px",
        height: "42px",
        borderRadius: isMobile ? "0" : "14px 14px 0 0",
        borderBottom: "1px solid var(--modal-header-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--modal-text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          {t("header")}
        </span>
        <div
          style={{
            width: "1px",
            height: "14px",
            background: "var(--glass-border)",
            flexShrink: 0,
          }}
        />
        <div
          className="model-dropdown-anchor"
          style={{ position: "relative" }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowModelDropdown(!showModelDropdown);
              setShowSettings(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              padding: "2px 7px",
              borderRadius: "4px",
              cursor: "pointer",
              background: "var(--glass-bg)",
              color: "var(--modal-text-muted)",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxWidth: isMobile ? "100px" : "none",
              transition: "color 0.12s, background 0.12s",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentModelLabel}
            </span>
            <FaChevronDown style={{ fontSize: "7px", flexShrink: 0, opacity: 0.5 }} />
          </div>
          <ModelDropdown
            model={settings.model}
            onChange={(model) => onSettingsChange({ model })}
            isOpen={showModelDropdown}
            onToggle={() => setShowModelDropdown(false)}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "1px", flexShrink: 0 }}>
        <div className="settings-anchor" style={{ position: "relative" }}>
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setShowModelDropdown(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={HEADER_BTN_STYLE}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          <SettingsPopover
            settings={settings}
            onChange={onSettingsChange}
            isOpen={showSettings}
            supportsReasoning={supportsReasoning}
            supportsReasoningToggle={supportsReasoningToggle}
          />
        </div>
        {hasMessages && (
          <button
            onClick={onClearChat}
            onMouseDown={(e) => e.stopPropagation()}
            style={HEADER_BTN_STYLE}
          >
            <FaTrash style={{ fontSize: "11px" }} />
          </button>
        )}
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          style={HEADER_BTN_STYLE}
        >
          <FaTimes style={{ fontSize: "11px" }} />
        </button>
      </div>
    </div>
  );
}
