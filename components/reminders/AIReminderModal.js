"use client";

import { useState, useEffect, useRef } from "react";
import { FaMagic, FaSpinner, FaTimes, FaTrash, FaCheck, FaEdit } from "react-icons/fa";
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
    emptyChat: "開始與 AI 助理對話\n描述您想建立的提醒",
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
    emptyChat: "Start chatting with AI Assistant\nDescribe the reminder you want to create",
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
  { value: "google/gemini-3-pro", label: "Gemini 3 Pro" },
  { value: "google/gemini-3-flash", label: "Gemini 3 Flash" },
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
    language: "zh"
  });
  const [messages, setMessages] = useState([]);
  const [previewReminder, setPreviewReminder] = useState(null);
  const [isEditingPreview, setIsEditingPreview] = useState(false);
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
        language: parsed.language || "zh"
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("請輸入提醒內容");
      return;
    }

    const userMessage = text.trim();
    setText("");

    const newUserMsg = { role: "user", content: userMessage };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      setIsGenerating(true);
      setError("");

      const conversationMessages = [...messages, newUserMsg].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch("/api/ai/generate-reminder-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          text: userMessage,
          messages: conversationMessages,
          model: settings.model,
          reasoningEffort: settings.reasoningEffort,
          reasoningEnabled: settings.reasoningEnabled,
          language: settings.language,
        }),
      });

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let fullReasoning = "";
      let buffer = "";
      let currentReasoningExpanded = true;

      const assistantMsgIndex = messages.length + 1;
      setMessages(prev => [...prev, { role: "assistant", content: "", reasoning: "", reasoningExpanded: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.reasoning) {
                fullReasoning += delta.reasoning;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMsgIndex] = { ...updated[assistantMsgIndex], reasoning: fullReasoning };
                  return updated;
                });
              }

              if (delta?.content) {
                fullContent += delta.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMsgIndex] = { ...updated[assistantMsgIndex], content: fullContent };
                  return updated;
                });
              }

              if (parsed.choices?.[0]?.finish_reason === "stop") {
                currentReasoningExpanded = false;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMsgIndex] = { ...updated[assistantMsgIndex], reasoningExpanded: false };
                  return updated;
                });
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }

      const jsonMatches = fullContent.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      
      if (jsonMatches && jsonMatches.length > 0) {
        try {
          const jsonData = JSON.parse(jsonMatches[jsonMatches.length - 1]);
          setPreviewReminder(jsonData);
        } catch (e) {
          setError("無法解析 AI 回應的 JSON");
        }
      }
    } catch (error) {
      console.error("Error generating reminder:", error);
      setError(error.message || "發生錯誤，請重試");
      setMessages(prev => prev.slice(0, -1));
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
      setMessages([]);
      setPreviewReminder(null);
      setError("");
    }
  };

  const toggleReasoningExpanded = (index) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], reasoningExpanded: !updated[index].reasoningExpanded };
      return updated;
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
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
        className="fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-300"
        onClick={onClose}
      />

      <div
        className="fixed z-[9999] w-[900px] max-h-[85vh] shadow-2xl"
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: "900px",
          maxHeight: "85vh",
          borderRadius: "20px",
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          boxShadow: "0 8px 32px rgba(31, 38, 135, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
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
                <FaMagic style={{ color: "rgba(139, 92, 246, 0.9)", fontSize: "16px" }} />
                <h3 style={{ fontSize: "15px", fontWeight: "600", color: "rgba(255, 255, 255, 0.95)" }}>
                  {t.chatTitle}
                </h3>
              </div>
              {messages.length > 0 && (
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
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
                  <FaMagic style={{ fontSize: "48px", opacity: 0.3 }} />
                  <p style={{ fontSize: "14px", textAlign: "center", whiteSpace: "pre-line" }}>{t.emptyChat}</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {msg.role === "user" ? (
                      <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "10px 14px", background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)", borderRadius: "12px 12px 2px 12px", fontSize: "13px", color: "rgba(255, 255, 255, 0.95)" }}>
                        {msg.content}
                      </div>
                    ) : (
                      <div style={{ alignSelf: "flex-start", maxWidth: "85%", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {msg.reasoning && (
                          <div style={{ padding: "10px 14px", background: "rgba(139, 92, 246, 0.08)", borderLeft: "3px solid rgba(139, 92, 246, 0.6)", borderRadius: "0 8px 8px 0" }}>
                            <div
                              onClick={() => toggleReasoningExpanded(index)}
                              style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "rgba(139, 92, 246, 1)", marginBottom: msg.reasoningExpanded ? "8px" : "0", userSelect: "none" }}
                            >
                              <span style={{ transition: "transform 0.2s", transform: msg.reasoningExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span> {t.reasoning}
                            </div>
                            {msg.reasoningExpanded && (
                              <div className="markdown-content" style={{ fontSize: "12px", lineHeight: "1.6", color: "rgba(255, 255, 255, 0.75)" }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.reasoning}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                        {msg.content && (
                          <div className="markdown-content" style={{ padding: "10px 14px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px 12px 12px 2px", fontSize: "13px", color: "rgba(255, 255, 255, 0.9)" }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
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
                  onClick={handleGenerate}
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
                  {isGenerating ? <FaSpinner className="animate-spin" /> : <FaMagic />}
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
