"use client";

import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { FaSpinner, FaTimes, FaTrash, FaCheck, FaEdit, FaRobot } from "react-icons/fa";
import AgentStepIndicator from "./AgentStepIndicator";
import AgentThinkingIndicator from "./AgentThinkingIndicator";
import AgentActivityLog from "./AgentActivityLog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Button from "../ui/Button";

const translations = {
  zh: {
    title: "AI 提醒生成器",
    chatTitle: "AI 助理對話",
    previewTitle: "提醒預覽",
    clearChat: "清空對話",
    confirmClear: "確定要清空對話記錄嗎？",
    emptyAgenticChat: "使用多代理系統\n透明顯示每個處理步驟",
    emptyPreview: "尚無提醒預覽\n請先與 AI 對話生成提醒",
    placeholder: "描述您的提醒，例如：\"明天下午 3 點提醒我打電話\" 或要求修改現有提醒",
    send: "發送",
    generating: "生成中",
    edit: "編輯",
    finishEdit: "完成編輯",
    confirm: "確認創建",
    reasoning: "推理過程",
    model: "模型",
    reasoningEffort: "推理強度",
    reasoningToggle: "推理模式",
    enabled: "開啟",
    disabled: "關閉",
    language: "語言",
    low: "低",
    medium: "中",
    high: "高",
    titleLabel: "標題",
    descLabel: "描述",
    dateTimeLabel: "日期時間",
    categoryLabel: "類別",
    recurringLabel: "重複類型",
    personal: "個人",
    work: "工作",
    health: "健康",
    other: "其他",
    daily: "每天",
    weekly: "每週",
    monthly: "每月",
    yearly: "每年"
  },
  en: {
    title: "AI Reminder Generator",
    chatTitle: "AI Assistant Chat",
    previewTitle: "Reminder Preview",
    clearChat: "Clear Chat",
    confirmClear: "Are you sure you want to clear the chat history?",
    emptyAgenticChat: "Using Multi-Agent System\nTransparently shows each processing step",
    emptyPreview: "No Preview Yet\nChat with AI to generate a reminder first",
    placeholder: 'Describe your reminder, e.g., "Remind me to call tomorrow at 3 PM" or request modifications',
    send: "Send",
    generating: "Generating",
    edit: "Edit",
    finishEdit: "Finish Edit",
    confirm: "Confirm Create",
    reasoning: "Reasoning",
    model: "Model",
    reasoningEffort: "Reasoning Effort",
    reasoningToggle: "Reasoning Mode",
    enabled: "Enabled",
    disabled: "Disabled",
    language: "Language",
    low: "Low",
    medium: "Medium",
    high: "High",
    titleLabel: "Title",
    descLabel: "Description",
    dateTimeLabel: "Date & Time",
    categoryLabel: "Category",
    recurringLabel: "Recurring Type",
    personal: "Personal",
    work: "Work",
    health: "Health",
    other: "Other",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly"
  }
};

const modelOptions = [
  { value: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
];

export default function AIReminderModal({ isOpen, onClose, onSuccess }) {
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [settings, setSettings] = useState({
    model: "x-ai/grok-4.1-fast",
    reasoningEffort: "medium",
    reasoningEnabled: true,
    language: "zh",
    reasoningLanguage: "zh"
  });
  const [previewReminder, setPreviewReminder] = useState(null);
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [agentMessages, setAgentMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [thinkingPhase, setThinkingPhase] = useState(null);
  const [currentToolCall, setCurrentToolCall] = useState(null);
  const [agentActivities, setAgentActivities] = useState([]);
  const [currentReasoning, setCurrentReasoning] = useState("");
  const [completedReasoning, setCompletedReasoning] = useState(""); // Saved after processing completes
  const messagesEndRef = useRef(null);
  
  const t = translations[settings.language] || translations.zh;

  useEffect(() => {
    const savedSettings = localStorage.getItem("ai_reminder_settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings({
        model: parsed.model || "x-ai/grok-4.1-fast",
        reasoningEffort: parsed.reasoningEffort || "medium",
        reasoningEnabled: parsed.reasoningEnabled !== undefined ? parsed.reasoningEnabled : true,
        language: parsed.language || "zh",
        reasoningLanguage: parsed.reasoningLanguage || "zh"
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      setPosition({
        x: (windowWidth - 900) / 2,
        y: windowHeight * 0.1,
      });
      setError("");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleMouseDown = (e) => {
    if (e.target.closest(".modal-header") && !e.target.closest("select, button")) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      const maxX = window.innerWidth - 480;
      const maxY = window.innerHeight - 100;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };
  }, [isDragging, dragOffset]);

  const handleAgenticGenerate = async () => {
    if (!text.trim()) {
      setError(settings.language === "en" ? "Please enter reminder content" : "請輸入提醒內容");
      return;
    }

    const userMessage = text.trim();
    setText("");

    // Add user message to agent messages
    setAgentMessages(prev => [...prev, { type: "user", content: userMessage }]);

    try {
      setIsGenerating(true);
      setError("");
      setAgentSteps([]);
      setSuggestions([]);
      setThinkingPhase(null);
      setCurrentToolCall(null);
      setAgentActivities([]); // Clear activity log for new request
      setCurrentReasoning(""); // Clear reasoning for new request
      setCompletedReasoning(""); // Clear completed reasoning for new request

      const response = await fetch("/api/ai/agentic-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: userMessage,
          // Include full conversation history (both user and agent messages)
          messages: agentMessages.map(m => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.content || "",
          })),
          model: settings.model,
          reasoningEffort: settings.reasoningEffort,
          reasoningEnabled: settings.reasoningEnabled,
          language: settings.language,
          reasoningLanguage: settings.reasoningLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Track current agent state
      let currentAgentName = "";
      let currentAgentReasoning = "";
      let currentAgentContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case "pipeline_start":
                  setAgentSteps(event.steps.map(s => ({ ...s, status: "pending" })));
                  break;

                case "step_start":
                  setAgentSteps(prev => prev.map((s, i) => 
                    i === event.stepIndex ? { ...s, status: "active" } : s
                  ));
                  break;

                case "thinking_phase":
                  setThinkingPhase({
                    phase: event.phase,
                    description: event.description,
                  });
                  
                  // Add step separator to timeline for iteration > 1
                  if (event.iteration > 1) {
                    setAgentMessages(prev => {
                      const updated = [...prev];
                      const lastMsgIdx = updated.length - 1;
                      if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                        const timeline = [...(updated[lastMsgIdx].timeline || [])];
                        timeline.push({
                          type: "step",
                          iteration: event.iteration,
                          title: event.description
                        });
                        updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                      }
                      return updated;
                    });
                  }
                  break;

                // Initialize new agent message with timeline structure
                case "agent_start":
                  currentAgentName = event.agent;
                  currentAgentReasoning = "";
                  currentAgentContent = "";
                  setAgentMessages(prev => [...prev, {
                    type: "agent",
                    agent: event.agent,
                    timeline: [{
                      type: "step",
                      iteration: 1,
                      title: "Step 1"
                    }], 
                    isStreaming: true,
                  }]);
                  break;

                case "reasoning":
                  currentAgentReasoning = event.fullContent;
                  // Use flushSync for immediate rendering of streaming content
                  flushSync(() => {
                    setAgentMessages(prev => {
                      const updated = [...prev];
                      const lastMsgIdx = updated.length - 1;
                      if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                        const timeline = [...(updated[lastMsgIdx].timeline || [])];
                        const lastBlockIdx = timeline.length - 1;
                        
                        // Check if we should update existing block or create new one
                        // We update if: it's reasoning, not completed, AND belongs to same iteration
                        const sameIteration = event.iteration ? (timeline[lastBlockIdx]?.iteration === event.iteration) : true;
                        
                        if (lastBlockIdx >= 0 && 
                            timeline[lastBlockIdx].type === "reasoning" && 
                            !timeline[lastBlockIdx].completed &&
                            sameIteration) {
                          // Update existing block with iteration-specific reasoning if available, or full content
                          timeline[lastBlockIdx] = { 
                            ...timeline[lastBlockIdx], 
                            content: event.iterationReasoning || event.fullContent 
                          };
                        } else {
                          // Start new reasoning block
                          // If previous block was open reasoning, close it
                          if (lastBlockIdx >= 0 && timeline[lastBlockIdx].type === "reasoning") {
                             timeline[lastBlockIdx] = { ...timeline[lastBlockIdx], completed: true, expanded: false };
                          }
                          
                          timeline.push({ 
                            type: "reasoning", 
                            content: event.iterationReasoning || event.fullContent, 
                            completed: false, 
                            expanded: true,
                            iteration: event.iteration 
                          });
                        }
                        updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                      }
                      return updated;
                    });
                  });
                  break;

                case "content":
                  currentAgentContent = event.fullContent;
                  setAgentMessages(prev => {
                    const updated = [...prev];
                    const lastMsgIdx = updated.length - 1;
                    if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                      const timeline = [...(updated[lastMsgIdx].timeline || [])];
                      const lastBlockIdx = timeline.length - 1;
                      
                      // Close any open reasoning block
                      if (lastBlockIdx >= 0 && timeline[lastBlockIdx].type === "reasoning") {
                         timeline[lastBlockIdx] = { ...timeline[lastBlockIdx], completed: true, expanded: false };
                      }

                      // Check if we should update existing content block or create new one
                      const sameIteration = event.iteration ? (timeline[lastBlockIdx]?.iteration === event.iteration) : true;

                      if (lastBlockIdx >= 0 && 
                          timeline[lastBlockIdx].type === "content" &&
                          sameIteration) {
                        timeline[lastBlockIdx] = { 
                          ...timeline[lastBlockIdx], 
                          content: event.iterationContent || event.fullContent 
                        };
                      } else {
                        timeline.push({ 
                          type: "content", 
                          content: event.iterationContent || event.fullContent,
                          iteration: event.iteration
                        });
                      }
                      
                      updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                    }
                    return updated;
                  });
                  break;

                case "tool_call":
                  setCurrentToolCall({
                    tool: event.tool,
                    description: event.description,
                    params: event.params,
                  });
                  
                  // Add tool block to timeline
                  setAgentMessages(prev => {
                    const updated = [...prev];
                    const lastMsgIdx = updated.length - 1;
                    if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                      const timeline = [...(updated[lastMsgIdx].timeline || [])];
                      
                      // Close previous reasoning block if open
                      const lastBlockIdx = timeline.length - 1;
                      if (lastBlockIdx >= 0 && timeline[lastBlockIdx].type === "reasoning") {
                         timeline[lastBlockIdx] = { ...timeline[lastBlockIdx], completed: true, expanded: false };
                      }

                      timeline.push({
                        type: "tool",
                        tool: event.tool,
                        input: event.params,
                        status: "running",
                        description: event.description,
                        iteration: event.iteration
                      });
                      
                      updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                    }
                    return updated;
                  });
                  break;

                case "tool_result":
                  // Update the specific tool block in timeline
                  setAgentMessages(prev => {
                    const updated = [...prev];
                    const lastMsgIdx = updated.length - 1;
                    if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                      const timeline = [...(updated[lastMsgIdx].timeline || [])];
                      // Find the running tool block (usually the last one or close to end)
                      // We search from end backwards
                      const toolBlockIdx = timeline.map(b => b.type).lastIndexOf("tool");
                      
                      if (toolBlockIdx >= 0) {
                         timeline[toolBlockIdx] = {
                           ...timeline[toolBlockIdx],
                           status: event.success ? "success" : "error",
                           result: event.result
                         };
                      }
                      updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                    }
                    return updated;
                  });
                  setCurrentToolCall(null);
                  break;
                  
                case "tool_error":
                   // Update tool block to error
                   setAgentMessages(prev => {
                    const updated = [...prev];
                    const lastMsgIdx = updated.length - 1;
                    if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                      const timeline = [...(updated[lastMsgIdx].timeline || [])];
                      const toolBlockIdx = timeline.map(b => b.type).lastIndexOf("tool");
                      if (toolBlockIdx >= 0) {
                         timeline[toolBlockIdx] = { ...timeline[toolBlockIdx], status: "error" };
                      }
                      updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                    }
                    return updated;
                  });
                  setCurrentToolCall(null);
                  break;

                case "agent_complete":
                  setAgentMessages(prev => {
                    const updated = [...prev];
                    const lastMsgIdx = updated.length - 1;
                    if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                       const timeline = [...(updated[lastMsgIdx].timeline || [])];
                       // Ensure all blocks are marked completed
                       const lastBlockIdx = timeline.length - 1;
                       if (lastBlockIdx >= 0 && timeline[lastBlockIdx].type === "reasoning") {
                          timeline[lastBlockIdx] = { ...timeline[lastBlockIdx], completed: true, expanded: false };
                       }
                       
                      updated[lastMsgIdx] = { 
                        ...updated[lastMsgIdx], 
                        isStreaming: false,
                        timeline
                      };
                    }
                    return updated;
                  });
                  setCurrentReasoning("");
                  setCompletedReasoning("");
                  break;

                case "step_complete":
                  setAgentSteps(prev => prev.map((s, i) => 
                    i === event.stepIndex ? { ...s, status: "completed" } : s
                  ));
                  break;

                case "step_skip":
                  setAgentSteps(prev => prev.map((s, i) => 
                    i === event.stepIndex ? { ...s, status: "skipped" } : s
                  ));
                  break;

                case "pipeline_complete":
                  // Handle reminder from new simple orchestrator
                  if (event.reminder) {
                    setPreviewReminder(event.reminder);
                  } else if (event.finalResult?.reminder) {
                    setPreviewReminder(event.finalResult.reminder);
                  }
                  if (event.finalResult?.suggestions) {
                    setSuggestions(event.finalResult.suggestions);
                  }
                  // Clear indicators after completion
                  setAgentSteps([]);
                  setThinkingPhase(null);
                  setCurrentToolCall(null);
                  break;

                case "error":
                  setError(event.error);
                  break;
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in agentic generation:", error);
      setError(error.message || (settings.language === "en" ? "An error occurred" : "發生錯誤，請重試"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateReminder = async () => {
    if (!previewReminder) return;

    try {
      const createResponse = await fetch("/api/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(previewReminder),
      });

      const createData = await createResponse.json();

      if (createData.success) {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(createData.error || "建立提醒失敗");
      }
    } catch (error) {
      console.error("Error creating reminder:", error);
      setError("發生錯誤，請重試");
    }
  };

  const handleClearChat = () => {
    if (window.confirm(t.confirmClear)) {
      setAgentMessages([]);
      setAgentSteps([]);
      setSuggestions([]);
      setPreviewReminder(null);
      setError("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAgenticGenerate();
    }
  };

  const handleModelChange = (e) => {
    const newSettings = { ...settings, model: e.target.value };
    setSettings(newSettings);
    localStorage.setItem("ai_reminder_settings", JSON.stringify(newSettings));
  };

  const handleReasoningEffortChange = (e) => {
    const newSettings = { ...settings, reasoningEffort: e.target.value };
    setSettings(newSettings);
    localStorage.setItem("ai_reminder_settings", JSON.stringify(newSettings));
  };

  const handleLanguageChange = (e) => {
    const newSettings = { ...settings, language: e.target.value };
    setSettings(newSettings);
    localStorage.setItem("ai_reminder_settings", JSON.stringify(newSettings));
  };

  const handleReasoningEnabledChange = (e) => {
    const newSettings = { ...settings, reasoningEnabled: e.target.value === "true" };
    setSettings(newSettings);
    localStorage.setItem("ai_reminder_settings", JSON.stringify(newSettings));
  };

  const isGeminiModel = settings.model.includes("gemini");
  const isGrokModel = settings.model.includes("grok");
  const isDeepSeekModel = settings.model.includes("deepseek");
  const supportsReasoningToggle = isGrokModel || isDeepSeekModel;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed z-[9999] w-[900px] max-h-[85vh] shadow-2xl"
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: "900px",
          maxHeight: "85vh",
          borderRadius: "20px",
          background: "rgba(20, 20, 30, 0.95)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          transition: isDragging ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(-10px)",
          opacity: isOpen ? 1 : 0,
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="modal-header flex items-center justify-between cursor-move select-none" style={{ padding: "10px 12px", borderRadius: "20px 20px 0 0", background: "rgba(255, 255, 255, 0.06)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255, 255, 255, 0.12)" }}>
          <div className="flex items-center gap-2.5 flex-1">
            <select
              value={settings.model}
              onChange={handleModelChange}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                padding: "5px 10px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                borderRadius: "8px",
                color: "rgba(255, 255, 255, 0.95)",
                fontSize: "11px",
                cursor: "pointer",
                outline: "none",
                transition: "all 0.2s ease",
                minWidth: "140px",
                colorScheme: "dark"
              }}
            >
              {modelOptions.map(option => (
                <option key={option.value} value={option.value} style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>
                  {option.label}
                </option>
              ))}
            </select>

            {isGeminiModel && (
              <select
                value={settings.reasoningEffort}
                onChange={handleReasoningEffortChange}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  padding: "5px 10px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: "8px",
                  color: "rgba(255, 255, 255, 0.95)",
                  fontSize: "11px",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  minWidth: "60px",
                  colorScheme: "dark"
                }}
              >
                <option value="low" style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>{t.low}</option>
                <option value="medium" style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>{t.medium}</option>
                <option value="high" style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>{t.high}</option>
              </select>
            )}

            {supportsReasoningToggle && (
              <select
                value={settings.reasoningEnabled.toString()}
                onChange={handleReasoningEnabledChange}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  padding: "5px 10px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: "8px",
                  color: "rgba(255, 255, 255, 0.95)",
                  fontSize: "11px",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  minWidth: "60px",
                  colorScheme: "dark"
                }}
              >
                <option value="true" style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>{t.enabled}</option>
                <option value="false" style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>{t.disabled}</option>
              </select>
            )}

            <select
              value={settings.language}
              onChange={handleLanguageChange}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                padding: "5px 10px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                borderRadius: "8px",
                color: "rgba(255, 255, 255, 0.95)",
                fontSize: "11px",
                cursor: "pointer",
                outline: "none",
                transition: "all 0.2s ease",
                minWidth: "80px",
                colorScheme: "dark"
              }}
            >
              <option value="zh" style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>繁體中文</option>
              <option value="en" style={{ background: "#1e1e2e", color: "rgba(255, 255, 255, 0.95)" }}>English</option>
            </select>

          </div>

          <button
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "rgba(255, 255, 255, 0.9)",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "300",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              flexShrink: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
              e.currentTarget.style.transform = "rotate(90deg) scale(1.1)";
              e.currentTarget.style.color = "rgba(239, 68, 68, 1)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
              e.currentTarget.style.transform = "rotate(0deg) scale(1)";
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
            }}
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", height: "calc(85vh - 60px)", gap: "16px", padding: "16px" }}>
          {/* 左側對話區 */}
          <div style={{ flex: "1 1 60%", display: "flex", flexDirection: "column", background: "rgba(255, 255, 255, 0.04)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            {/* 對話標題和清空按鈕 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FaRobot style={{ color: "rgba(139, 92, 246, 0.9)", fontSize: "16px" }} />
                <h3 style={{ fontSize: "15px", fontWeight: "600", color: "rgba(255, 255, 255, 0.95)" }}>
                  {t.chatTitle}
                </h3>
              </div>
              {agentMessages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    color: "rgba(239, 68, 68, 0.9)",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                  }}
                >
                  <FaTrash style={{ fontSize: "11px" }} />
                  {t.clearChat}
                </button>
              )}
            </div>

            {/* 對話訊息列表 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {agentMessages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
                    <FaRobot style={{ fontSize: "48px", opacity: 0.3 }} />
                    <p style={{ fontSize: "14px", textAlign: "center", whiteSpace: "pre-line" }}>{t.emptyAgenticChat}</p>
                  </div>
                ) : (
                  <>
                    {/* Agent Messages */}
                    {agentMessages.map((msg, index) => (
                      <div key={index} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {msg.type === "user" ? (
                          /* User message */
                          <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "10px 14px", background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)", borderRadius: "12px 12px 2px 12px", fontSize: "13px", color: "rgba(255, 255, 255, 0.95)" }}>
                            {msg.content}
                          </div>
                        ) : (
                          /* Agent message - Timeline based rendering */
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignSelf: "flex-start", maxWidth: "90%", width: "100%" }}>
                            {msg.timeline && msg.timeline.map((block, bIdx) => {
                              if (block.type === "step") {
                                return (
                                  <div key={`step-${bIdx}`} style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "8px", 
                                    margin: "8px 0 4px 0",
                                    opacity: 0.7 
                                  }}>
                                    <div style={{ 
                                      padding: "2px 8px", 
                                      background: "rgba(255, 255, 255, 0.1)", 
                                      borderRadius: "4px", 
                                      fontSize: "11px", 
                                      fontWeight: "600",
                                      color: "rgba(255, 255, 255, 0.9)"
                                    }}>
                                      Step {block.iteration}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
                                      {block.title}
                                    </div>
                                    <div style={{ flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.1)" }}></div>
                                  </div>
                                );
                              }

                              if (block.type === "reasoning") {
                                return (
                                  <AgentActivityLog
                                    key={`reasoning-${bIdx}`}
                                    activities={[]}
                                    currentPhase={null}
                                    currentToolCall={null}
                                    currentReasoning={block.content}
                                    completedReasoning={block.completed ? block.content : ""}
                                    isActive={!block.completed}
                                    language={settings.language}
                                  />
                                );
                              }
                              
                              if (block.type === "tool") {
                                return (
                                  <div key={`tool-${bIdx}`} className="tool-block" style={{ width: "100%" }}>
                                    {/* Tool Execution Status Bar */}
                                    <div style={{ 
                                      display: "flex", 
                                      alignItems: "center", 
                                      gap: "10px", 
                                      padding: "10px 14px", 
                                      background: "rgba(255, 255, 255, 0.03)", 
                                      border: "1px solid rgba(255, 255, 255, 0.08)",
                                      borderRadius: "8px",
                                      marginBottom: "8px"
                                    }}>
                                      <div style={{ 
                                        display: "flex", 
                                        alignItems: "center", 
                                        justifyContent: "center",
                                        width: "20px", 
                                        height: "20px"
                                      }}>
                                        {block.status === "running" ? (
                                          <FaSpinner className="animate-spin" style={{ color: "rgba(139, 92, 246, 0.9)", fontSize: "14px" }} />
                                        ) : block.status === "success" ? (
                                          <FaCheck style={{ color: "rgba(34, 197, 94, 0.9)", fontSize: "14px" }} />
                                        ) : (
                                          <FaTimes style={{ color: "rgba(239, 68, 68, 0.9)", fontSize: "14px" }} />
                                        )}
                                      </div>
                                      
                                      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                        <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)", fontWeight: "500" }}>
                                          {block.description || block.tool}
                                        </span>
                                        <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                                          {block.status === "running" 
                                            ? (settings.language === "en" ? "Executing..." : "執行中...") 
                                            : block.status === "success"
                                              ? (settings.language === "en" ? "Completed" : "已完成")
                                              : (settings.language === "en" ? "Failed" : "失敗")}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Tool Result Details */}
                                    {block.status === "success" && block.result && (
                                      <div style={{ marginLeft: "4px" }}>
                                        {block.tool === "listReminders" && block.result.reminders ? (
                                          <div style={{
                                            background: "rgba(34, 197, 94, 0.05)",
                                            border: "1px solid rgba(34, 197, 94, 0.2)",
                                            borderRadius: "8px",
                                            padding: "12px",
                                          }}>
                                            <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                                              <span>📋</span>
                                              <span>{settings.language === "en" ? `Found ${block.result.count} reminders` : `找到 ${block.result.count} 個提醒`}</span>
                                            </div>
                                            {block.result.reminders.length > 0 && (
                                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                {block.result.reminders.slice(0, 5).map((reminder, rIdx) => (
                                                  <div key={rIdx} style={{ padding: "8px 10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                      <div style={{ fontWeight: "500", color: "rgba(255, 255, 255, 0.9)", fontSize: "12px" }}>{reminder.title}</div>
                                                      <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.5)", marginTop: "2px" }}>
                                                        {new Date(reminder.dateTime).toLocaleDateString()}
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                                {block.result.reminders.length > 5 && (
                                                   <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.4)", paddingLeft: "4px" }}>
                                                     ... +{block.result.reminders.length - 5} more
                                                   </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ) : block.tool === "deleteReminder" ? (
                                           <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "12px" }}>
                                              <span style={{ color: "rgba(239, 68, 68, 0.8)" }}>🗑</span>
                                              <span>{settings.language === "en" ? `Deleted: ${block.input?.title || 'Reminder'}` : `已刪除: ${block.input?.title || '提醒'}`}</span>
                                            </div>
                                        ) : block.tool === "createReminder" && block.result.reminder ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "8px", fontSize: "12px" }}>
                                              <span style={{ color: "rgba(34, 197, 94, 0.8)" }}>✓</span>
                                              <span>{settings.language === "en" ? "Created: " : "已建立: "}</span>
                                              <span style={{ fontWeight: "500" }}>{block.result.reminder.title}</span>
                                            </div>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (block.type === "content") {
                                return (
                                  <div key={`content-${bIdx}`} className="markdown-content" style={{ padding: "12px 16px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px 12px 12px 2px", fontSize: "13px", color: "rgba(255, 255, 255, 0.9)" }}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Live Activity Log - only shown during generation */}
                    {/* Note: In new timeline architecture, live events are directly appended to the timeline above.
                        However, if we are in "thinking phase" before any timeline events, we might want to show this.
                        Currently "agent_start" creates the message and timeline, so this might be redundant or for pre-agent work.
                    */}
                    {isGenerating && agentMessages.length === 0 && (
                       <AgentActivityLog
                        activities={agentActivities}
                        currentPhase={thinkingPhase}
                        currentToolCall={currentToolCall}
                        currentReasoning={currentReasoning}
                        completedReasoning={completedReasoning}
                        isActive={isGenerating}
                        language={settings.language}
                      />
                    )}
                  </>
                )}
              <div ref={messagesEndRef} />
            </div>

            {/* 輸入區 */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
              {error && (
                <p style={{ fontSize: "12px", color: "rgba(239, 68, 68, 0.9)", background: "rgba(239, 68, 68, 0.1)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.3)", marginBottom: "8px" }}>
                  {error}
                </p>
              )}
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t.placeholder}
                  rows="2"
                  disabled={isGenerating}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    color: "rgba(255, 255, 255, 0.95)",
                    fontSize: "13px",
                    outline: "none",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    resize: "none"
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "rgba(255, 255, 255, 0.12)";
                    e.target.style.borderColor = "rgba(139, 92, 246, 0.5)";
                  }}
                  onBlur={(e) => {
                    e.target.style.background = "rgba(255, 255, 255, 0.08)";
                    e.target.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  }}
                />
                <button
                  onClick={handleAgenticGenerate}
                  disabled={isGenerating || !text.trim()}
                  style={{
                    padding: "10px 16px",
                    background: isGenerating || !text.trim() ? "rgba(139, 92, 246, 0.3)" : "linear-gradient(135deg, rgba(139, 92, 246, 0.8) 0%, rgba(6, 182, 212, 0.8) 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: isGenerating || !text.trim() ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap"
                  }}
                  onMouseOver={(e) => {
                    if (!isGenerating && text.trim()) {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(139, 92, 246, 0.4)";
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {isGenerating ? <FaSpinner className="animate-spin" /> : <FaRobot />}
                  {isGenerating ? t.generating : t.send}
                </button>
              </div>
            </div>
          </div>

          {/* 右側預覽區 */}
          <div style={{ flex: "1 1 40%", display: "flex", flexDirection: "column", background: "rgba(255, 255, 255, 0.04)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "600", color: "rgba(255, 255, 255, 0.95)" }}>
                {t.previewTitle}
              </h3>
            </div>

            <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
              {previewReminder ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ padding: "16px", background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.3)", borderRadius: "12px" }}>
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)", display: "block", marginBottom: "4px" }}>{t.titleLabel}</label>
                      {isEditingPreview ? (
                        <input
                          type="text"
                          value={previewReminder.title}
                          onChange={(e) => setPreviewReminder({ ...previewReminder, title: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "8px",
                            color: "rgba(255, 255, 255, 0.95)",
                            fontSize: "14px",
                            fontWeight: "600",
                            outline: "none"
                          }}
                        />
                      ) : (
                        <p style={{ fontSize: "15px", fontWeight: "600", color: "rgba(255, 255, 255, 0.95)" }}>{previewReminder.title}</p>
                      )}
                    </div>

                    {previewReminder.description && (
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)", display: "block", marginBottom: "4px" }}>{t.descLabel}</label>
                        {isEditingPreview ? (
                          <textarea
                            value={previewReminder.description}
                            onChange={(e) => setPreviewReminder({ ...previewReminder, description: e.target.value })}
                            rows="2"
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              borderRadius: "8px",
                              color: "rgba(255, 255, 255, 0.9)",
                              fontSize: "13px",
                              outline: "none",
                              resize: "none",
                              fontFamily: "inherit"
                            }}
                          />
                        ) : (
                          <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)" }}>{previewReminder.description}</p>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)", display: "block", marginBottom: "4px" }}>{t.dateTimeLabel}</label>
                      {isEditingPreview ? (
                        <input
                          type="datetime-local"
                          value={previewReminder.dateTime}
                          onChange={(e) => setPreviewReminder({ ...previewReminder, dateTime: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "8px",
                            color: "rgba(255, 255, 255, 0.95)",
                            fontSize: "13px",
                            outline: "none",
                            colorScheme: "dark"
                          }}
                        />
                      ) : (
                        <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)" }}>{new Date(previewReminder.dateTime).toLocaleString('zh-TW')}</p>
                      )}
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)", display: "block", marginBottom: "4px" }}>{t.categoryLabel}</label>
                      {isEditingPreview ? (
                        <select
                          value={previewReminder.category}
                          onChange={(e) => setPreviewReminder({ ...previewReminder, category: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "8px",
                            color: "rgba(255, 255, 255, 0.95)",
                            fontSize: "13px",
                            outline: "none",
                            cursor: "pointer",
                            colorScheme: "dark"
                          }}
                        >
                          <option value="personal">{t.personal}</option>
                          <option value="work">{t.work}</option>
                          <option value="health">{t.health}</option>
                          <option value="other">{t.other}</option>
                        </select>
                      ) : (
                        <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)" }}>
                          {t[previewReminder.category] || previewReminder.category}
                        </p>
                      )}
                    </div>

                    {previewReminder.recurring && (
                      <div>
                        <label style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)", display: "block", marginBottom: "4px" }}>{t.recurringLabel}</label>
                        <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)" }}>
                          {t[previewReminder.recurringType] || previewReminder.recurringType}
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setIsEditingPreview(!isEditingPreview)}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "10px",
                        color: "rgba(255, 255, 255, 0.9)",
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      }}
                    >
                      <FaEdit />
                      {isEditingPreview ? t.finishEdit : t.edit}
                    </button>
                    <button
                      onClick={handleCreateReminder}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        background: "linear-gradient(135deg, rgba(34, 197, 94, 0.8) 0%, rgba(16, 185, 129, 0.8) 100%)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "10px",
                        color: "#fff",
                        fontSize: "13px",
                        fontWeight: "500",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "scale(1.05)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(34, 197, 94, 0.4)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <FaCheck />
                      {t.confirm}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255, 255, 255, 0.4)" }}>
                  <div style={{ fontSize: "48px", opacity: 0.3 }}>📋</div>
                  <p style={{ fontSize: "13px", textAlign: "center", whiteSpace: "pre-line" }}>{t.emptyPreview}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .modal-header:active {
          cursor: grabbing !important;
        }
        
        .markdown-content {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .markdown-content p {
          margin: 0 0 8px 0;
        }
        
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          margin: 8px 0 6px 0;
          font-weight: 600;
        }
        
        .markdown-content h1 {
          font-size: 18px;
        }
        
        .markdown-content h2 {
          font-size: 16px;
        }
        
        .markdown-content h3 {
          font-size: 14px;
        }
        
        .markdown-content ul, .markdown-content ol {
          margin: 4px 0 8px 0;
          padding-left: 20px;
        }
        
        .markdown-content li {
          margin: 2px 0;
        }
        
        .markdown-content code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Courier New', monospace;
        }
        
        .markdown-content pre {
          background: rgba(0, 0, 0, 0.3);
          padding: 10px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 8px 0;
        }
        
        .markdown-content pre code {
          background: none;
          padding: 0;
        }
        
        .markdown-content blockquote {
          border-left: 3px solid rgba(255, 255, 255, 0.3);
          padding-left: 12px;
          margin: 8px 0;
          color: rgba(255, 255, 255, 0.7);
        }
        
        .markdown-content strong {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }
        
        .markdown-content em {
          font-style: italic;
        }
        
        .markdown-content a {
          color: rgba(139, 92, 246, 1);
          text-decoration: underline;
        }
        
        .markdown-content hr {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          margin: 12px 0;
        }
        
        .markdown-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
        }
        
        .markdown-content th, .markdown-content td {
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 6px 10px;
          text-align: left;
        }
        
        .markdown-content th {
          background: rgba(255, 255, 255, 0.1);
          font-weight: 600;
        }
      `}</style>
    </>
  );
}
