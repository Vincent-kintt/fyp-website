"use client";

import { useTranslations } from "next-intl";

export default function SettingsPopover({
  settings,
  onChange,
  isOpen,
  supportsReasoning,
  supportsReasoningToggle,
}) {
  const t = useTranslations("aiModal");
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        right: 0,
        width: "280px",
        background: "var(--modal-bg, #111)",
        border: "1px solid var(--glass-border)",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "4px",
        zIndex: 20,
      }}
    >
      {(supportsReasoning || supportsReasoningToggle) && (
        <div style={{ padding: "14px 16px" }}>
          <div
            style={{
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            {t("reasoningSection")}
          </div>
          {supportsReasoningToggle && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: supportsReasoning ? "12px" : 0,
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--modal-text)" }}>
                {t("reasoningMode")}
              </span>
              <div
                onClick={() =>
                  onChange({ reasoningEnabled: !settings.reasoningEnabled })
                }
                style={{
                  width: "40px",
                  height: "22px",
                  borderRadius: "11px",
                  background: settings.reasoningEnabled
                    ? "var(--modal-text-muted)"
                    : "var(--glass-border)",
                  padding: "2px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#fff",
                    marginLeft: settings.reasoningEnabled ? "auto" : "0",
                    transition: "margin 0.2s",
                  }}
                />
              </div>
            </div>
          )}
          {supportsReasoning && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--modal-text)" }}>
                {t("effort")}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["low", "medium", "high"].map((level) => (
                  <div
                    key={level}
                    onClick={() => onChange({ reasoningEffort: level })}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      cursor: "pointer",
                      color:
                        settings.reasoningEffort === level
                          ? "var(--modal-text-secondary)"
                          : "var(--modal-text-muted)",
                      background:
                        settings.reasoningEffort === level
                          ? "var(--glass-bg-hover)"
                          : "var(--glass-bg)",
                      border: `1px solid ${settings.reasoningEffort === level ? "var(--glass-border-hover)" : "var(--glass-border)"}`,
                    }}
                  >
                    {level === "low"
                      ? t("effortLow")
                      : level === "medium"
                        ? t("effortMedium")
                        : t("effortHigh")}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {(supportsReasoning || supportsReasoningToggle) && (
        <div
          style={{
            height: "1px",
            background: "var(--glass-border)",
            margin: "0 16px",
          }}
        />
      )}
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            fontSize: "10px",
            color: "var(--modal-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          {t("aiLanguage")}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {[
            { value: "zh", label: "繁體中文" },
            { value: "en", label: "English" },
          ].map((lang) => (
            <div
              key={lang.value}
              onClick={() => onChange({ language: lang.value })}
              style={{
                flex: 1,
                padding: "6px 16px",
                borderRadius: "8px",
                fontSize: "12px",
                textAlign: "center",
                cursor: "pointer",
                color:
                  settings.language === lang.value
                    ? "var(--modal-text-secondary)"
                    : "var(--modal-text-muted)",
                background:
                  settings.language === lang.value
                    ? "var(--glass-bg-hover)"
                    : "var(--glass-bg)",
                border: `1px solid ${settings.language === lang.value ? "var(--glass-border-hover)" : "var(--glass-border)"}`,
              }}
            >
              {lang.label}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          height: "1px",
          background: "var(--glass-border)",
          margin: "0 16px",
        }}
      />
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--modal-text-muted)" }}>
          {t("shortcutOpenChat")}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <span
            style={{
              padding: "2px 6px",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "4px",
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              fontFamily: "monospace",
            }}
          >
            {typeof navigator !== "undefined" &&
            navigator?.platform?.includes("Mac")
              ? "Cmd"
              : "Ctrl"}
          </span>
          <span
            style={{
              padding: "2px 6px",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "4px",
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              fontFamily: "monospace",
            }}
          >
            J
          </span>
        </div>
      </div>
    </div>
  );
}
