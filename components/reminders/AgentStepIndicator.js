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
      background: "rgba(139, 92, 246, 0.05)",
      borderRadius: "12px",
      border: "1px solid rgba(139, 92, 246, 0.15)",
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
                ? "rgba(139, 92, 246, 0.2)" 
                : isCompleted 
                  ? "rgba(34, 197, 94, 0.15)" 
                  : isSkipped
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${
                isActive 
                  ? "rgba(139, 92, 246, 0.4)" 
                  : isCompleted 
                    ? "rgba(34, 197, 94, 0.3)" 
                    : isSkipped
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(255, 255, 255, 0.1)"
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
                  ? "rgba(139, 92, 246, 0.3)" 
                  : isCompleted 
                    ? "rgba(34, 197, 94, 0.3)" 
                    : isSkipped
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(255, 255, 255, 0.1)",
              }}>
                {isActive && <FaSpinner className="animate-spin" style={{ fontSize: "10px", color: "rgba(139, 92, 246, 1)" }} />}
                {isCompleted && <FaCheck style={{ fontSize: "10px", color: "rgba(34, 197, 94, 1)" }} />}
                {isSkipped && <FaForward style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.4)" }} />}
                {isPending && <Icon style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.4)" }} />}
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: isActive ? "600" : "500",
                color: isActive 
                  ? "rgba(139, 92, 246, 1)" 
                  : isCompleted 
                    ? "rgba(34, 197, 94, 0.9)" 
                    : "rgba(255, 255, 255, 0.5)",
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
                  ? "rgba(255, 255, 255, 0.2)" 
                  : "rgba(255, 255, 255, 0.15)",
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
