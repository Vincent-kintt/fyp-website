"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const translations = {
  zh: {
    reasoning: "推理過程",
  },
  en: {
    reasoning: "Reasoning",
  },
};

export default function AgentMessageBubble({ 
  agentName, 
  reasoning, 
  content, 
  toolResults = [],
  isStreaming = false,
  language = "zh",
  defaultExpanded = false,
  forceCollapsed = false,
}) {
  const [reasoningExpanded, setReasoningExpanded] = useState(defaultExpanded);
  
  // Auto-collapse reasoning when forceCollapsed changes to true
  useEffect(() => {
    if (forceCollapsed) {
      setReasoningExpanded(false);
    }
  }, [forceCollapsed]);
  
  const t = translations[language] || translations.zh;

  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "85%", display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Reasoning Section - Minimal Cascade Style */}
      {reasoning && (
        <div>
          <div
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "5px", 
              cursor: "pointer", 
              padding: "2px 0",
              userSelect: "none",
            }}
          >
            <span style={{ 
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              transition: "transform 0.15s ease",
              transform: reasoningExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}>▶</span>
            <span style={{ 
              fontSize: "13px",
              color: "var(--modal-accent)",
            }}>{t.reasoning}</span>
          </div>
          {reasoningExpanded && (
            <div 
              className="markdown-content" 
              style={{ 
                fontSize: "13px", 
                lineHeight: "1.6", 
                color: "var(--modal-text-secondary)",
                paddingLeft: "12px",
                marginTop: "4px",
                borderLeft: "1px solid var(--glass-border)",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
      
      {/* Content Section - matching original design */}
      {content && (
        <div 
          className="markdown-content" 
          style={{ 
            padding: "10px 14px", 
            background: "var(--agent-bubble-bg)", 
            border: "1px solid var(--agent-bubble-border)", 
            borderRadius: "12px 12px 12px 2px", 
            fontSize: "13px", 
            color: "var(--modal-text)" 
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
      
      {/* Tool Results - Display reminder lists and other tool outputs */}
      {toolResults && toolResults.length > 0 && toolResults.map((tr, idx) => (
        <div key={idx} style={{
          background: tr.success ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)",
          border: `1px solid ${tr.success ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
          borderRadius: "8px",
          padding: "12px",
          fontSize: "12px",
        }}>
          {/* List Reminders Result */}
          {tr.tool === "listReminders" && tr.result?.reminders && (
            <div>
              <div style={{ 
                fontSize: "11px", 
                color: "var(--modal-text-muted)", 
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span>📋</span>
                <span>{language === "en" ? `Found ${tr.result.count} reminders` : `找到 ${tr.result.count} 個提醒`}</span>
              </div>
              {tr.result.reminders.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {tr.result.reminders.slice(0, 10).map((reminder, rIdx) => (
                    <div key={rIdx} style={{
                      padding: "8px 10px",
                      background: "var(--glass-bg)",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontWeight: "500", color: "var(--modal-text)" }}>
                          {reminder.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--modal-text-muted)", marginTop: "2px" }}>
                          {new Date(reminder.dateTime).toLocaleString(language === "en" ? "en-US" : "zh-TW", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })}
                          {" • "}
                          <span style={{ 
                            padding: "1px 6px", 
                            borderRadius: "4px", 
                            background: reminder.category === "work" ? "rgba(59, 130, 246, 0.2)" :
                                       reminder.category === "health" ? "rgba(34, 197, 94, 0.2)" :
                                       reminder.category === "personal" ? "rgba(139, 92, 246, 0.2)" :
                                       "rgba(255, 255, 255, 0.1)",
                            fontSize: "10px"
                          }}>
                            {reminder.category}
                          </span>
                        </div>
                      </div>
                      {reminder.completed && (
                        <span style={{ color: "var(--success-text)" }}>✓</span>
                      )}
                    </div>
                  ))}
                  {tr.result.reminders.length > 10 && (
                    <div style={{ fontSize: "11px", background: "var(--glass-border)", textAlign: "center" }}>
                      {language === "en" ? `... and ${tr.result.reminders.length - 10} more` : `... 還有 ${tr.result.reminders.length - 10} 個`}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: "var(--modal-text-muted)", textAlign: "center", padding: "8px" }}>
                  {language === "en" ? "No reminders found" : "沒有找到提醒"}
                </div>
              )}
            </div>
          )}
          
          {/* Create Reminder Result */}
          {tr.tool === "createReminder" && tr.result?.reminder && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "rgba(34, 197, 94, 0.8)" }}>✓</span>
              <span>{language === "en" ? "Created: " : "已建立: "}</span>
              <span style={{ fontWeight: "500" }}>{tr.result.reminder.title}</span>
            </div>
          )}
          
          {/* Delete Reminder Result */}
          {tr.tool === "deleteReminder" && tr.success && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "rgba(239, 68, 68, 0.8)" }}>🗑</span>
              <span>{language === "en" ? "Reminder deleted" : "提醒已刪除"}</span>
            </div>
          )}
          
          {/* Generic success/error for other tools */}
          {!["listReminders", "createReminder", "deleteReminder"].includes(tr.tool) && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{tr.success ? "✓" : "✗"}</span>
              <span>{tr.tool}: {tr.success ? (language === "en" ? "completed" : "完成") : (language === "en" ? "failed" : "失敗")}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
