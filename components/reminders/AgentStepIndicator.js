"use client";

import { FaCheck, FaSpinner, FaClock, FaBrain, FaTags, FaMagic, FaForward } from "react-icons/fa";

const stepIcons = {
  planner: FaBrain,
  timeResolver: FaClock,
  category: FaTags,
  executor: FaMagic,
  reviewer: FaCheck,
};

const translations = {
  zh: {
    planner: "規劃分析",
    timeResolver: "時間解析",
    category: "分類判斷",
    executor: "執行任務",
    reviewer: "確認結果",
    skipped: "已跳過",
  },
  en: {
    planner: "Planning",
    timeResolver: "Time Resolution",
    category: "Classification",
    executor: "Execution",
    reviewer: "Review",
    skipped: "Skipped",
  },
};

export default function AgentStepIndicator({ steps, currentStep, language = "zh" }) {
  const t = translations[language] || translations.zh;

  return (
    <div className="agent-step-indicator" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      background: "var(--modal-accent-light)",
      borderRadius: "12px",
      border: "1px solid var(--modal-accent-border)",
      marginBottom: "12px",
      gap: "4px",
      flexWrap: "wrap",
    }}>
      {steps.map((step, index) => {
        const Icon = stepIcons[step.id] || FaMagic;
        const isActive = step.status === "active";
        const isCompleted = step.status === "completed";
        const isSkipped = step.status === "skipped";
        const isPending = step.status === "pending";

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: "fit-content" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "8px",
              background: isActive 
                ? "var(--modal-accent-active)" 
                : isCompleted 
                  ? "var(--modal-accent-completed)" 
                  : isSkipped
                    ? "var(--glass-bg)"
                    : "var(--glass-bg)",
              border: `1px solid ${
                isActive 
                  ? "var(--modal-accent-active-border)" 
                  : isCompleted 
                    ? "var(--modal-accent-completed-border)" 
                    : isSkipped
                      ? "var(--glass-border)"
                      : "var(--glass-border)"
              }`,
              opacity: isSkipped ? 0.6 : 1,
              transition: "all 0.3s ease",
            }}>
              <div style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive 
                  ? "var(--modal-accent-active)" 
                  : isCompleted 
                    ? "var(--modal-accent-completed)" 
                    : isSkipped
                      ? "var(--glass-border)"
                      : "var(--glass-border)",
              }}>
                {isActive && <FaSpinner className="animate-spin" style={{ fontSize: "10px", color: "var(--modal-accent-active)" }} />}
                {isCompleted && <FaCheck style={{ fontSize: "10px", color: "var(--modal-accent-completed)" }} />}
                {isSkipped && <FaForward style={{ fontSize: "10px", color: "var(--modal-text-muted)" }} />}
                {isPending && <Icon style={{ fontSize: "10px", color: "var(--modal-text-muted)" }} />}
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: isActive ? "600" : "500",
                color: isActive 
                  ? "var(--modal-accent-active)" 
                  : isCompleted 
                    ? "var(--modal-accent-completed)" 
                    : "var(--modal-text-muted)",
                whiteSpace: "nowrap",
                textDecoration: isSkipped ? "line-through" : "none",
              }}>
                {t[step.id] || step.name}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: "2px",
                minWidth: "8px",
                maxWidth: "24px",
                margin: "0 4px",
                background: isCompleted || isSkipped
                  ? "var(--glass-border)" 
                  : "var(--glass-border)",
                borderRadius: "1px",
                transition: "all 0.3s ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
