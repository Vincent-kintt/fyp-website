"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Agent Activity Log - Cascade-style transparent agentic process
 * Modern, minimal design with expandable sections
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

  // Track thinking time
  useEffect(() => {
    let interval;
    if (isActive && currentReasoning) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (!isActive) {
      // Keep final time when done
    }
    return () => clearInterval(interval);
  }, [isActive, currentReasoning]);

  // Reset time on new request
  useEffect(() => {
    if (isActive && !currentReasoning) {
      setElapsedTime(0);
    }
  }, [isActive, currentReasoning]);

  // Auto-collapse when reasoning completes (isActive changes from true to false)
  useEffect(() => {
    if (prevIsActiveRef.current === true && isActive === false) {
      setThinkingExpanded(false);
    }
    prevIsActiveRef.current = isActive;
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
  
  return (
    <div style={{ marginTop: "8px" }}>
      {/* Thinking Section - Cascade Style */}
      {(hasReasoning || (isActive && currentPhase)) && (
        <div style={{ marginBottom: hasActivities ? "8px" : "0" }}>
          {/* Thinking Header - "Thought for Xs >" */}
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
              color: "rgba(180, 140, 100, 0.9)",
              fontWeight: "400",
            }}>
              {isActive && currentReasoning 
                ? (language === "en" ? `Thought for ${formatTime(elapsedTime)}` : `思考了 ${formatTime(elapsedTime)}`)
                : (language === "en" ? `Thought for ${formatTime(elapsedTime)}` : `思考了 ${formatTime(elapsedTime)}`)}
            </span>
            <span style={{
              fontSize: "10px",
              color: "rgba(255, 255, 255, 0.35)",
              transform: thinkingExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}>▶</span>
          </div>

          {/* Thinking Content */}
          {thinkingExpanded && (
            <div 
              ref={scrollRef}
              style={{
                marginTop: "6px",
                paddingLeft: "12px",
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                maxHeight: "250px",
                overflowY: "auto",
              }}
            >
              {isActive && !reasoning && currentPhase && (
                <div style={{
                  fontSize: "13px",
                  color: "rgba(255, 255, 255, 0.5)",
                  fontStyle: "italic",
                }}>
                  {currentPhase.description}...
                </div>
              )}
              {reasoning && (
                <div style={{
                  fontSize: "13px",
                  color: "rgba(255, 255, 255, 0.7)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {reasoning}
                  {isActive && currentReasoning && (
                    <span style={{ 
                      opacity: 0.5,
                      animation: "blink 1s infinite",
                    }}>|</span>
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
          {/* Activities Header */}
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
              color: "rgba(255, 255, 255, 0.35)",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}>▶</span>
            <span style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.5)",
            }}>
              {successCount > 0 
                ? (language === "en" ? `${successCount} task${successCount > 1 ? 's' : ''} done` : `${successCount} 個任務完成`)
                : (language === "en" ? `${activities.length} step${activities.length > 1 ? 's' : ''}` : `${activities.length} 個步驟`)}
            </span>
            {successCount > 0 && (
              <span style={{ color: "rgba(34, 197, 94, 0.7)", fontSize: "12px" }}>✓</span>
            )}
          </div>

          {/* Activities List */}
          {isExpanded && (
            <div style={{
              marginTop: "4px",
              paddingLeft: "12px",
              borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
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
                    color: activity.type === "tool_success" ? "rgba(34, 197, 94, 0.8)" : 
                           activity.type === "tool_error" ? "rgba(239, 68, 68, 0.8)" :
                           "rgba(255, 255, 255, 0.55)",
                  }}
                >
                  <span style={{ fontSize: "11px" }}>
                    {activity.type === "tool_success" ? "✓" : 
                     activity.type === "tool_error" ? "✗" : "→"}
                  </span>
                  <span>{activity.message}</span>
                  {activity.detail && (
                    <span style={{ color: "rgba(255, 255, 255, 0.35)", fontSize: "11px" }}>
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
          color: "rgba(255, 255, 255, 0.55)",
        }}>
          <span style={{ fontSize: "11px" }}>→</span>
          <span>{currentToolCall.description}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
