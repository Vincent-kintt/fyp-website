"use client";

import { FaSpinner, FaCheck, FaTimes } from "react-icons/fa";
import ToolResultCard from "../ToolResultCard";
import { MUTATION_TOOLS, getToolName, getToolDescription } from "./toolHelpers";

export default function ToolInvocationBlock({ part, language }) {
  const toolName = getToolName(part);
  const { state, input, output, errorText } = part;
  const isRunning = state === "input-streaming" || state === "input-available";
  const isSuccess = state === "output-available";
  const isError = state === "output-error";
  const isReadOnly = isSuccess && !MUTATION_TOOLS.includes(toolName);
  const description = getToolDescription(
    toolName,
    state,
    isSuccess ? output : null,
  );

  return (
    <div style={{ width: "100%" }}>
      {/* Tool step — left-bordered flat row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 10px",
          borderLeft: "2px solid var(--tool-step-border, var(--glass-border))",
          marginLeft: "2px",
          marginBottom: isSuccess || isError ? "8px" : "0",
        }}
      >
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "3px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: isRunning
              ? "var(--glass-bg)"
              : isError
                ? "var(--tool-error-bg)"
                : isReadOnly
                  ? "rgba(59,130,246,0.08)"
                  : "var(--tool-success-bg)",
          }}
        >
          {isRunning ? (
            <FaSpinner
              className="animate-spin"
              style={{ color: "var(--modal-text-muted)", fontSize: "8px" }}
            />
          ) : isSuccess ? (
            <FaCheck
              style={{
                color: isReadOnly ? "#60a5fa" : "var(--success)",
                fontSize: "8px",
              }}
            />
          ) : (
            <FaTimes style={{ color: "var(--danger)", fontSize: "8px" }} />
          )}
        </div>
        <span
          style={{
            flex: 1,
            fontSize: "12px",
            color: "var(--modal-text-muted)",
          }}
        >
          {description}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "var(--modal-text-muted)",
            padding: "1px 5px",
            background: "var(--glass-bg)",
            borderRadius: "3px",
            opacity: 0.6,
          }}
        >
          {toolName}
        </span>
      </div>
      {(isSuccess || isError) && (
        <div style={{ marginLeft: "4px" }}>
          <ToolResultCard
            tool={toolName}
            result={isSuccess ? output : null}
            input={input}
            success={isSuccess}
            error={isError ? errorText || "Unknown error" : null}
            language={language}
          />
        </div>
      )}
    </div>
  );
}
