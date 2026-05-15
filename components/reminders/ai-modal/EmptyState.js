"use client";

import { useTranslations } from "next-intl";

export default function EmptyState({ language, onSelectPrompt }) {
  const t = useTranslations("aiModal");
  const suggestions = [
    {
      labelKey: "createReminder",
      prompt: language === "zh" ? "建立一個提醒" : "Create a reminder",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      labelKey: "todaySchedule",
      prompt: language === "zh" ? "列出今天的提醒" : "List today's reminders",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      labelKey: "planWeek",
      prompt: language === "zh" ? "幫我規劃本週" : "Help me plan this week",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      labelKey: "analyzePatterns",
      prompt: language === "zh" ? "分析我的提醒模式" : "Analyze my reminder patterns",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        padding: "32px",
      }}
    >
      <p
        style={{
          fontSize: "15px",
          color: "var(--modal-text-muted)",
          textAlign: "center",
        }}
      >
        {t("emptyStateTitle")}
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          width: "100%",
          maxWidth: "340px",
        }}
      >
        {suggestions.map((item) => (
          <button
            key={item.labelKey}
            onClick={() => onSelectPrompt(item.prompt)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.12s",
              width: "100%",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "var(--glass-bg)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "7px",
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--modal-text-muted)",
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>
            <span style={{ fontSize: "13px", color: "var(--modal-text-secondary)", flex: 1 }}>
              {t(`emptyChip.${item.labelKey}`)}
            </span>
            <span style={{ color: "var(--glass-border)", fontSize: "14px" }}>&#x203A;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
