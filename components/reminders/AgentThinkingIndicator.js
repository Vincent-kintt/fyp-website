"use client";

import { useState, useEffect } from "react";

export default function AgentThinkingIndicator({ 
  currentPhase, 
  phaseDescription,
  toolCall,
  language = "zh" 
}) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!currentPhase && !toolCall) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "14px 18px",
      background: "var(--glass-bg)",
      borderRadius: "8px",
      borderLeft: "2px solid var(--modal-accent)",
    }}>
      {/* Minimal spinner */}
      <div style={{
        width: "16px",
        height: "16px",
        border: "2px solid var(--modal-accent-border)",
        borderTopColor: "var(--modal-accent)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: "13px",
          fontWeight: "500",
          color: "var(--modal-text-secondary)",
          letterSpacing: "0.01em",
        }}>
          {toolCall ? toolCall.description : phaseDescription}{dots}
        </span>
        {toolCall?.params?.title && (
          <span style={{
            display: "block",
            fontSize: "12px",
            color: "var(--modal-text-muted)",
            marginTop: "4px",
          }}>
            {toolCall.params.title}
          </span>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
