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
      background: "rgba(255, 255, 255, 0.03)",
      borderRadius: "8px",
      borderLeft: "2px solid rgba(139, 92, 246, 0.6)",
    }}>
      {/* Minimal spinner */}
      <div style={{
        width: "16px",
        height: "16px",
        border: "2px solid rgba(139, 92, 246, 0.2)",
        borderTopColor: "rgba(139, 92, 246, 0.8)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: "13px",
          fontWeight: "500",
          color: "rgba(255, 255, 255, 0.7)",
          letterSpacing: "0.01em",
        }}>
          {toolCall ? toolCall.description : phaseDescription}{dots}
        </span>
        {toolCall?.params?.title && (
          <span style={{
            display: "block",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.4)",
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
