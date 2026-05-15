"use client";

import { FaCheck } from "react-icons/fa";
import { modelOptions } from "./modelOptions";

export default function ModelDropdown({ model, onChange, isOpen, onToggle }) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        width: "260px",
        background: "var(--modal-bg, #111)",
        border: "1px solid var(--glass-border)",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "6px",
        zIndex: 20,
      }}
    >
      {modelOptions.map((opt) => (
        <div
          key={opt.value}
          onClick={() => {
            onChange(opt.value);
            onToggle();
          }}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            cursor: "pointer",
            marginBottom: "4px",
            background:
              model === opt.value ? "var(--glass-bg-hover)" : "transparent",
            border:
              model === opt.value
                ? "1px solid var(--glass-border-hover)"
                : "1px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "13px",
                color: "var(--modal-text)",
                fontWeight: 500,
              }}
            >
              {opt.label}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--modal-text-muted)",
                marginTop: "2px",
              }}
            >
              {opt.desc}
            </div>
          </div>
          {model === opt.value && (
            <FaCheck
              style={{ color: "var(--modal-text-secondary)", fontSize: "12px", flexShrink: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
