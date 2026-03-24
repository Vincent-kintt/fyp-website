"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Agent Activity Log - Cascade-style transparent agentic process
 * Modern, minimal design with expandable sections + shimmer animation
 */
export default function AgentActivityLog({
  activities = [],
  currentPhase,
  currentToolCall,
  currentReasoning = "",
  completedReasoning = "",
  thinkingStartTime = null,
  isActive = false,
  language = "zh"
}) {
  const scrollRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const prevIsActiveRef = useRef(isActive);
  const collapseTimerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Track thinking time with performance.now() for sub-second precision
  useEffect(() => {
    let raf;
    if (isActive && currentReasoning) {
      if (!startTimeRef.current) startTimeRef.current = performance.now();
      const tick = () => {
        setElapsedTime(Math.round((performance.now() - startTimeRef.current) / 1000));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else if (!isActive && startTimeRef.current) {
      // Keep final time
      setElapsedTime(Math.round((performance.now() - startTimeRef.current) / 1000));
    }
    return () => raf && cancelAnimationFrame(raf);
  }, [isActive, currentReasoning]);

  // Reset time on new request
  useEffect(() => {
    if (isActive && !currentReasoning) {
      setElapsedTime(0);
      startTimeRef.current = null;
    }
  }, [isActive, currentReasoning]);

  // Auto-collapse with 300ms delay to avoid race condition with final streaming chunk
  useEffect(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);

    if (prevIsActiveRef.current === true && isActive === false) {
      collapseTimerRef.current = setTimeout(() => {
        setThinkingExpanded(false);
      }, 300);
    }
    prevIsActiveRef.current = isActive;

    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [isActive]);

  // Auto-scroll when active
  useEffect(() => {
    if (scrollRef.current && isActive && thinkingExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentReasoning, isActive, thinkingExpanded]);

  if (activities.length === 0 && !currentReasoning && !completedReasoning && !isActive) return null;

  const successCount = activities.filter(a => a.type === "tool_success").length;
  const formatTime = (seconds) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds/60)}m ${seconds%60}s`;

  const reasoning = currentReasoning || completedReasoning;
  const hasReasoning = reasoning.length > 0;
  const hasActivities = activities.length > 0;
  const isStreaming = isActive && currentReasoning;

  return (
    <div style={{ marginTop: "8px" }}>
      {/* Thinking Section - Cascade Style */}
      {(hasReasoning || (isActive && currentPhase)) && (
        <div style={{ marginBottom: hasActivities ? "8px" : "0" }}>
          {/* Thinking Header */}
          <div
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            <span style={{
              fontSize: "13px",
              color: "var(--modal-accent)",
              fontWeight: "400",
            }}>
              {isStreaming
                ? (language === "en" ? `Thinking ${formatTime(elapsedTime)}` : `思考中 ${formatTime(elapsedTime)}`)
                : (language === "en" ? `Thought for ${formatTime(elapsedTime)}` : `思考了 ${formatTime(elapsedTime)}`)}
            </span>
            <span style={{
              fontSize: "11px",
              color: "var(--modal-text-muted)",
              marginLeft: "4px",
            }}>
              {thinkingExpanded ? "▼" : "▶"}
            </span>
          </div>

          {/* Thinking Content */}
          {thinkingExpanded && (
            <div
              ref={scrollRef}
              className={isStreaming ? "reasoning-streaming" : ""}
              style={{
                marginTop: "6px",
                paddingLeft: "12px",
                borderLeft: "1px solid var(--glass-border)",
                maxHeight: "250px",
                overflowY: "auto",
                position: "relative",
              }}
            >
              {/* Skeleton loading state - no text yet but active */}
              {isActive && !reasoning && currentPhase && (
                <div className="reasoning-skeleton" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0" }}>
                  <div style={{ width: "85%" }} />
                  <div style={{ width: "65%" }} />
                  <div style={{ width: "75%" }} />
                </div>
              )}
              {reasoning && (
                <div style={{
                  fontSize: "13px",
                  color: "var(--modal-text-secondary)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {reasoning}
                  {isStreaming && (
                    <span className="reasoning-cursor">|</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Activities Section - Compact List */}
      {hasActivities && (
        <div>
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            <span style={{
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}>▶</span>
            <span style={{
              fontSize: "13px",
              color: "var(--modal-text-muted)",
            }}>
              {successCount > 0
                ? (language === "en" ? `${successCount} task${successCount > 1 ? 's' : ''} done` : `${successCount} 個任務完成`)
                : (language === "en" ? `${activities.length} step${activities.length > 1 ? 's' : ''}` : `${activities.length} 個步驟`)}
            </span>
            {successCount > 0 && (
              <span style={{ color: "var(--success)", fontSize: "12px" }}>✓</span>
            )}
          </div>

          {isExpanded && (
            <div style={{
              marginTop: "4px",
              paddingLeft: "12px",
              borderLeft: "1px solid var(--glass-border)",
            }}>
              {activities.map((activity, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "3px 0",
                    fontSize: "12px",
                    color: activity.type === "tool_success" ? "var(--success)" :
                           activity.type === "tool_error" ? "var(--danger)" :
                           "var(--modal-text-muted)",
                  }}
                >
                  <span style={{ fontSize: "11px" }}>
                    {activity.type === "tool_success" ? "✓" :
                     activity.type === "tool_error" ? "✗" : "→"}
                  </span>
                  <span>{activity.message}</span>
                  {activity.detail && (
                    <span style={{ color: "var(--modal-text-muted)", fontSize: "11px" }}>
                      ({activity.detail})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Tool Call */}
      {isActive && currentToolCall && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 0",
          marginTop: "4px",
          fontSize: "12px",
          color: "var(--modal-text-muted)",
        }}>
          <span style={{ fontSize: "11px" }}>→</span>
          <span>{currentToolCall.description}</span>
        </div>
      )}

      <style jsx>{`
        .reasoning-cursor {
          opacity: 0.5;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
