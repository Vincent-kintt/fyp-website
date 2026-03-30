"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FaSpinner,
  FaTimes,
  FaCheck,
  FaRobot,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import ToolResultCard from "./ToolResultCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MUTATION_TOOLS = [
  "createReminder",
  "updateReminder",
  "deleteReminder",
  "batchCreate",
  "snoozeReminder",
  "setQuickReminder",
  "templateCreate",
];

const translations = {
  zh: {
    title: "AI 提醒生成器",
    chatTitle: "AI 助理對話",
    previewTitle: "提醒預覽",
    clearChat: "清空對話",
    confirmClear: "確定要清空對話記錄嗎？",
    emptyAgenticChat: "使用多代理系統\n透明顯示每個處理步驟",
    emptyPreview: "尚無提醒預覽\n請先與 AI 對話生成提醒",
    placeholder:
      '描述您的提醒，例如："明天下午 3 點提醒我打電話" 或要求修改現有提醒',
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
    yearly: "每年",
  },
  en: {
    title: "AI Reminder Generator",
    chatTitle: "AI Assistant Chat",
    previewTitle: "Reminder Preview",
    clearChat: "Clear Chat",
    confirmClear: "Are you sure you want to clear the chat history?",
    emptyAgenticChat:
      "Using Multi-Agent System\nTransparently shows each processing step",
    emptyPreview: "No Preview Yet\nChat with AI to generate a reminder first",
    placeholder:
      'Describe your reminder, e.g., "Remind me to call tomorrow at 3 PM" or request modifications',
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
    yearly: "Yearly",
  },
};

const modelOptions = [
  { value: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
];

// Extract tool name from a part (handles both typed tool-<name> and dynamic-tool)
function getToolName(part) {
  if (part.type === "dynamic-tool") return part.toolName;
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return null;
}

// Check if a part is a tool invocation
function isToolPart(part) {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

// Collapsible reasoning block
function ReasoningBlock({ text, isStreaming, language }) {
  const [expanded, setExpanded] = useState(isStreaming);

  // Auto-collapse when streaming finishes
  useEffect(() => {
    if (!isStreaming && text) {
      setExpanded(false);
    }
  }, [isStreaming, text]);

  if (!text) return null;

  const label = language === "zh" ? "推理過程" : "Reasoning";

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "none",
          border: "none",
          color: "var(--modal-text-muted)",
          fontSize: "12px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {expanded ? (
          <FaChevronUp style={{ fontSize: "10px" }} />
        ) : (
          <FaChevronDown style={{ fontSize: "10px" }} />
        )}
        <span style={{ fontWeight: "500" }}>{label}</span>
        {isStreaming && (
          <FaSpinner
            className="animate-spin"
            style={{ fontSize: "10px", marginLeft: "auto" }}
          />
        )}
      </button>
      {expanded && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--glass-border)",
            fontSize: "12px",
            color: "var(--modal-text-muted)",
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

// Tool invocation card with status + result
function ToolInvocationBlock({ part, language }) {
  const toolName = getToolName(part);
  const { state, input, output, errorText } = part;

  const isRunning = state === "input-streaming" || state === "input-available";
  const isSuccess = state === "output-available";
  const isError = state === "output-error";

  const description = toolName;

  return (
    <div className="tool-block" style={{ width: "100%" }}>
      {/* Tool Execution Status Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          borderRadius: "8px",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
          }}
        >
          {isRunning ? (
            <FaSpinner
              className="animate-spin"
              style={{ color: "var(--modal-accent)", fontSize: "14px" }}
            />
          ) : isSuccess ? (
            <FaCheck style={{ color: "var(--success)", fontSize: "14px" }} />
          ) : (
            <FaTimes style={{ color: "var(--danger)", fontSize: "14px" }} />
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "13px",
              color: "var(--modal-text)",
              fontWeight: "500",
            }}
          >
            {description}
          </span>
          <span style={{ fontSize: "11px", color: "var(--modal-text-muted)" }}>
            {isRunning
              ? language === "en"
                ? "Executing..."
                : "執行中..."
              : isSuccess
                ? language === "en"
                  ? "Completed"
                  : "已完成"
                : language === "en"
                  ? "Failed"
                  : "失敗"}
          </span>
        </div>
      </div>

      {/* Tool Result Details */}
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

export default function AIReminderModal({
  isOpen,
  onClose,
  onSuccess,
  initialText = "",
}) {
  const [input, setInput] = useState(initialText);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [settings, setSettings] = useState({
    model: "x-ai/grok-4.1-fast",
    reasoningEffort: "medium",
    reasoningEnabled: true,
    language: "zh",
    reasoningLanguage: "zh",
  });
  const [userLocation, setUserLocation] = useState(null);
  const messagesEndRef = useRef(null);
  const hasPendingRefreshRef = useRef(false);

  // Refs for values that need to be read by the transport/callbacks without re-creating them
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const onSuccessRefForChat = useRef(onSuccess);
  onSuccessRefForChat.current = onSuccess;

  const t = translations[settings.language] || translations.zh;

  // Stable transport -- reads latest settings via refs so it doesn't need to be re-created
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/agentic-reminder",
        body: () => ({
          model: settingsRef.current.model,
          reasoningEffort: settingsRef.current.reasoningEffort,
          language: settingsRef.current.language,
          userLocation: userLocationRef.current,
        }),
      }),
    [],
  );

  // --- useChat hook ---
  const {
    messages,
    sendMessage,
    status,
    error: chatError,
    setMessages,
  } = useChat({
    transport,
    onFinish: ({ message }) => {
      const hasMutation = message.parts?.some((p) => {
        const toolName = getToolName(p);
        if (!toolName) return false;
        return (
          MUTATION_TOOLS.includes(toolName) &&
          p.state === "output-available" &&
          p.output?.success
        );
      });
      if (hasMutation) {
        hasPendingRefreshRef.current = true;
        onSuccessRefForChat.current?.();
      }
    },
  });

  const isProcessing = status !== "ready";

  // Derive suggested follow-up actions from the last assistant message's tool parts
  const suggestions = useMemo(() => {
    if (isProcessing || messages.length === 0) return [];
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant?.parts) return [];
    const toolParts = lastAssistant.parts.filter(
      (p) => isToolPart(p) && p.state === "output-available",
    );
    if (toolParts.length === 0) return [];
    const lastTool = toolParts[toolParts.length - 1];
    const toolName = getToolName(lastTool);

    const zh = settings.language === "zh";
    const actions = {
      createReminder: [
        {
          label: zh ? "查看今天" : "List today's",
          prompt: zh ? "列出今天的提醒" : "List today's reminders",
        },
        {
          label: zh ? "再建一個" : "Create another",
          prompt: zh ? "再建立一個提醒" : "Create another reminder",
        },
        {
          label: zh ? "檢查衝突" : "Find conflicts",
          prompt: zh ? "檢查時間衝突" : "Check for time conflicts",
        },
      ],
      listReminders: [
        {
          label: zh ? "摘要" : "Summarize",
          prompt: zh ? "總結這些提醒" : "Summarize these reminders",
        },
        {
          label: zh ? "檢查衝突" : "Find conflicts",
          prompt: zh ? "檢查時間衝突" : "Check for time conflicts",
        },
        {
          label: zh ? "分析模式" : "Analyze patterns",
          prompt: zh ? "分析我的提醒模式" : "Analyze my reminder patterns",
        },
      ],
      deleteReminder: [
        {
          label: zh ? "查看剩餘" : "List remaining",
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
        {
          label: zh ? "建立新的" : "Create new",
          prompt: zh ? "建立一個新提醒" : "Create a new reminder",
        },
      ],
      analyzePatterns: [
        {
          label: zh ? "本週摘要" : "This week",
          prompt: zh ? "總結本週的任務" : "Summarize this week's tasks",
        },
        {
          label: zh ? "列出全部" : "List all",
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
      ],
      updateReminder: [
        {
          label: zh ? "查看全部" : "List all",
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
        {
          label: zh ? "檢查衝突" : "Find conflicts",
          prompt: zh ? "檢查時間衝突" : "Check for time conflicts",
        },
      ],
    };
    return (
      actions[toolName] || [
        {
          label: zh ? "列出提醒" : "List reminders",
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
        {
          label: zh ? "建立提醒" : "Create reminder",
          prompt: zh ? "建立一個提醒" : "Create a reminder",
        },
        {
          label: zh ? "分析模式" : "Analyze",
          prompt: zh ? "分析我的提醒模式" : "Analyze my patterns",
        },
      ]
    );
  }, [messages, isProcessing, settings.language]);

  // --- Mount/unmount with closing animation ---
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
    }, 150);
  }, [onClose]);

  // --- Get user location on mount (with permission) ---
  useEffect(() => {
    const getLocation = async () => {
      const cached = localStorage.getItem("user_location");
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) {
          setUserLocation(data);
          return;
        }
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=${settings.language === "zh" ? "zh-TW" : "en"}`,
              );
              const data = await response.json();
              const locationData = {
                city:
                  data.address?.city ||
                  data.address?.town ||
                  data.address?.village ||
                  data.address?.county,
                region: data.address?.state || data.address?.province,
                country: data.address?.country,
                latitude,
                longitude,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              };
              setUserLocation(locationData);
              localStorage.setItem(
                "user_location",
                JSON.stringify({ data: locationData, timestamp: Date.now() }),
              );
            } catch (err) {
              console.log("Reverse geocoding failed, using coordinates only");
              const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              };
              setUserLocation(locationData);
            }
          },
          (error) => {
            console.log("Geolocation denied or unavailable:", error.message);
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setUserLocation({ timezone, inferred: true });
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 3600000 },
        );
      } else {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setUserLocation({ timezone, inferred: true });
      }
    };

    getLocation();
  }, [settings.language]);

  // --- Load saved settings ---
  useEffect(() => {
    const savedSettings = localStorage.getItem("ai_reminder_settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings({
        model: parsed.model || "x-ai/grok-4.1-fast",
        reasoningEffort: parsed.reasoningEffort || "medium",
        reasoningEnabled:
          parsed.reasoningEnabled !== undefined
            ? parsed.reasoningEnabled
            : true,
        language: parsed.language || "zh",
        reasoningLanguage: parsed.reasoningLanguage || "zh",
      });
    }
  }, []);

  // Store onSuccess in a ref so cleanup can access latest value
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // Handle component unmount - refresh if there were mutations
  useEffect(() => {
    return () => {
      if (hasPendingRefreshRef.current && onSuccessRef.current) {
        onSuccessRef.current();
        hasPendingRefreshRef.current = false;
      }
    };
  }, []);

  // Update input when initialText changes (from QuickAdd forward)
  useEffect(() => {
    if (initialText && isOpen) {
      setInput(initialText);
    }
  }, [initialText, isOpen]);

  // Position and mobile detection on open
  useEffect(() => {
    if (isOpen) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const mobile = windowWidth < 768;
      setIsMobile(mobile);
      setPosition({
        x: mobile ? 0 : (windowWidth - 900) / 2,
        y: mobile ? 0 : windowHeight * 0.1,
      });
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      if (hasPendingRefreshRef.current && onSuccess) {
        onSuccess();
        hasPendingRefreshRef.current = false;
      }
    }
  }, [isOpen, onSuccess]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && shouldRender) {
        handleAnimatedClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [shouldRender, handleAnimatedClose]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // --- Dragging ---
  const handleMouseDown = (e) => {
    if (
      e.target.closest(".modal-header") &&
      !e.target.closest("select, button")
    ) {
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

  // --- Handlers ---
  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput("");
    sendMessage({ text });
  }, [input, isProcessing, sendMessage]);

  const handleClearChat = useCallback(() => {
    if (window.confirm(t.confirmClear)) {
      setMessages([]);
    }
  }, [setMessages, t.confirmClear]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
    const newSettings = {
      ...settings,
      reasoningEnabled: e.target.value === "true",
    };
    setSettings(newSettings);
    localStorage.setItem("ai_reminder_settings", JSON.stringify(newSettings));
  };

  const isGeminiModel = settings.model.includes("gemini");
  const isGrokModel = settings.model.includes("grok");
  const isDeepSeekModel = settings.model.includes("deepseek");
  const supportsReasoningToggle = isGrokModel || isDeepSeekModel;

  // Error display: combine chatError with any local display need
  const errorMessage = chatError?.message || null;

  if (!shouldRender) return null;

  return (
    <>
      <div
        className={`${isMobile ? "fixed inset-0 z-[9999]" : "fixed z-[9999] w-[900px] max-h-[85vh] shadow-2xl"} ${isClosing ? "modal-panel-exit" : "modal-panel-enter"}`}
        style={{
          position: "fixed",
          ...(isMobile
            ? {}
            : { left: `${position.x}px`, top: `${position.y}px` }),
          borderRadius: isMobile ? "0" : "20px",
          background: "var(--modal-bg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: isMobile ? "none" : "1px solid var(--modal-border)",
          boxShadow: isMobile ? "none" : "var(--modal-shadow)",
          transition: isDragging ? "none" : "none",
        }}
        onMouseDown={isMobile ? undefined : handleMouseDown}
      >
        {/* Header with settings */}
        <div
          className={`modal-header flex items-center justify-between ${isMobile ? "" : "cursor-move"} select-none`}
          style={{
            padding: "10px 12px",
            borderRadius: isMobile ? "0" : "20px 20px 0 0",
            background: "var(--modal-header-bg)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--modal-header-border)",
          }}
        >
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select
              value={settings.model}
              onChange={handleModelChange}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                padding: "5px 10px",
                background: "var(--select-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                color: "var(--modal-text)",
                fontSize: "11px",
                cursor: "pointer",
                outline: "none",
                transition: "all 0.2s ease",
                minWidth: "140px",
              }}
            >
              {modelOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  style={{
                    background: "var(--select-option-bg)",
                    color: "var(--modal-text)",
                  }}
                >
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
                  background: "var(--select-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "8px",
                  color: "var(--modal-text)",
                  fontSize: "11px",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  minWidth: "60px",
                }}
              >
                <option
                  value="low"
                  style={{
                    background: "var(--select-option-bg)",
                    color: "var(--modal-text)",
                  }}
                >
                  {t.low}
                </option>
                <option
                  value="medium"
                  style={{
                    background: "var(--select-option-bg)",
                    color: "var(--modal-text)",
                  }}
                >
                  {t.medium}
                </option>
                <option
                  value="high"
                  style={{
                    background: "var(--select-option-bg)",
                    color: "var(--modal-text)",
                  }}
                >
                  {t.high}
                </option>
              </select>
            )}

            {supportsReasoningToggle && (
              <select
                value={settings.reasoningEnabled.toString()}
                onChange={handleReasoningEnabledChange}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  padding: "5px 10px",
                  background: "var(--select-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "8px",
                  color: "var(--modal-text)",
                  fontSize: "11px",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  minWidth: "60px",
                }}
              >
                <option
                  value="true"
                  style={{
                    background: "var(--select-option-bg)",
                    color: "var(--modal-text)",
                  }}
                >
                  {t.enabled}
                </option>
                <option
                  value="false"
                  style={{
                    background: "var(--select-option-bg)",
                    color: "var(--modal-text)",
                  }}
                >
                  {t.disabled}
                </option>
              </select>
            )}

            <select
              value={settings.language}
              onChange={handleLanguageChange}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                padding: "5px 10px",
                background: "var(--select-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                color: "var(--modal-text)",
                fontSize: "11px",
                cursor: "pointer",
                outline: "none",
                transition: "all 0.2s ease",
                minWidth: "80px",
              }}
            >
              <option
                value="zh"
                style={{
                  background: "var(--select-option-bg)",
                  color: "var(--modal-text)",
                }}
              >
                繁體中文
              </option>
              <option
                value="en"
                style={{
                  background: "var(--select-option-bg)",
                  color: "var(--modal-text)",
                }}
              >
                English
              </option>
            </select>
          </div>

          <button
            onClick={handleAnimatedClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--glass-bg-hover)",
              backdropFilter: "blur(10px)",
              border: "1px solid var(--glass-border-hover)",
              color: "var(--modal-text)",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "300",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              flexShrink: 0,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "var(--tool-error-bg)";
              e.currentTarget.style.borderColor = "var(--tool-error-border)";
              e.currentTarget.style.transform = "rotate(90deg) scale(1.1)";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "var(--glass-bg-hover)";
              e.currentTarget.style.borderColor = "var(--glass-border-hover)";
              e.currentTarget.style.transform = "rotate(0deg) scale(1)";
              e.currentTarget.style.color = "var(--modal-text)";
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div
          style={{
            display: "flex",
            height: isMobile ? "calc(100vh - 52px)" : "calc(85vh - 60px)",
            padding: isMobile ? "8px" : "16px",
          }}
        >
          {/* Chat Area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "var(--glass-bg)",
              borderRadius: isMobile ? "8px" : "12px",
              border: "1px solid var(--glass-border)",
            }}
          >
            {/* Chat title and clear button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <FaRobot
                  style={{ color: "var(--modal-accent)", fontSize: "16px" }}
                />
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "var(--modal-text)",
                  }}
                >
                  {t.chatTitle}
                </h3>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  style={{
                    padding: "6px 12px",
                    background: "var(--tool-error-bg)",
                    border: "1px solid var(--tool-error-border)",
                    borderRadius: "8px",
                    color: "#ef4444",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background =
                      "var(--tool-error-border)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "var(--tool-error-bg)";
                  }}
                >
                  <FaTrash style={{ fontSize: "11px" }} />
                  {t.clearChat}
                </button>
              )}
            </div>

            {/* Message list */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    color: "var(--modal-text-muted)",
                  }}
                >
                  <FaRobot style={{ fontSize: "48px", opacity: 0.3 }} />
                  <p
                    style={{
                      fontSize: "14px",
                      textAlign: "center",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {t.emptyAgenticChat}
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {msg.role === "user" ? (
                        /* User message */
                        <div
                          style={{
                            alignSelf: "flex-end",
                            maxWidth: "80%",
                            padding: "10px 14px",
                            background: "var(--user-bubble-bg)",
                            border: "1px solid var(--user-bubble-border)",
                            borderRadius: "12px 12px 2px 12px",
                            fontSize: "13px",
                            color: "var(--modal-text)",
                          }}
                        >
                          {msg.parts?.map((part, i) =>
                            part.type === "text" ? (
                              <span key={i}>{part.text}</span>
                            ) : null,
                          )}
                        </div>
                      ) : (
                        /* Assistant message - render parts */
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            alignSelf: "flex-start",
                            maxWidth: "90%",
                            width: "100%",
                          }}
                        >
                          {msg.parts?.map((part, pIdx) => {
                            if (part.type === "step-start") {
                              return (
                                <div
                                  key={`step-${pIdx}`}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    margin: "8px 0 4px 0",
                                    opacity: 0.7,
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: "2px 8px",
                                      background: "var(--glass-border)",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontWeight: "600",
                                      color: "var(--modal-text)",
                                    }}
                                  >
                                    Step
                                  </div>
                                  <div
                                    style={{
                                      flex: 1,
                                      height: "1px",
                                      background: "var(--glass-border)",
                                    }}
                                  ></div>
                                </div>
                              );
                            }

                            if (part.type === "reasoning") {
                              return (
                                <ReasoningBlock
                                  key={`reasoning-${pIdx}`}
                                  text={part.text}
                                  isStreaming={part.state === "streaming"}
                                  language={settings.language}
                                />
                              );
                            }

                            if (isToolPart(part)) {
                              return (
                                <ToolInvocationBlock
                                  key={`tool-${pIdx}`}
                                  part={part}
                                  language={settings.language}
                                />
                              );
                            }

                            if (part.type === "text") {
                              const cleanContent = (part.text || "").trim();
                              if (!cleanContent) return null;

                              return (
                                <div
                                  key={`content-${pIdx}`}
                                  className="markdown-content"
                                  style={{
                                    padding: "12px 16px",
                                    background: "var(--agent-bubble-bg)",
                                    border:
                                      "1px solid var(--agent-bubble-border)",
                                    borderRadius: "12px 12px 12px 2px",
                                    fontSize: "13px",
                                    color: "var(--modal-text)",
                                  }}
                                >
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {cleanContent}
                                  </ReactMarkdown>
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Streaming indicator when processing but no assistant parts yet */}
                  {isProcessing &&
                    (() => {
                      const lastMsg = messages[messages.length - 1];
                      const hasAssistantContent =
                        lastMsg?.role === "assistant" &&
                        lastMsg.parts?.length > 0;
                      if (hasAssistantContent) return null;
                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "12px 16px",
                            color: "var(--modal-text-muted)",
                            fontSize: "13px",
                          }}
                        >
                          <FaSpinner
                            className="animate-spin"
                            style={{ fontSize: "14px" }}
                          />
                          <span>
                            {settings.language === "zh"
                              ? "思考中..."
                              : "Thinking..."}
                          </span>
                        </div>
                      );
                    })()}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              {errorMessage && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: "#ef4444",
                    background: "var(--tool-error-bg)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--tool-error-border)",
                    marginBottom: "8px",
                  }}
                >
                  <span>{errorMessage}</span>
                </div>
              )}
              {/* Suggested Actions */}
              {!isProcessing &&
                messages.length > 0 &&
                suggestions.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginBottom: "8px",
                      overflowX: "auto",
                      paddingBottom: "2px",
                    }}
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(s.prompt)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "9999px",
                          fontSize: "11px",
                          fontWeight: "500",
                          background: "var(--glass-bg)",
                          color: "var(--modal-accent)",
                          border: "1px solid var(--glass-border)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "all 0.15s",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background =
                            "var(--glass-bg-hover)";
                          e.currentTarget.style.borderColor =
                            "var(--modal-accent-border)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "var(--glass-bg)";
                          e.currentTarget.style.borderColor =
                            "var(--glass-border)";
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              <div
                style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t.placeholder}
                  rows="2"
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: "var(--modal-input-bg)",
                    border: "1px solid var(--modal-input-border)",
                    borderRadius: "10px",
                    color: "var(--modal-text)",
                    fontSize: "13px",
                    outline: "none",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    resize: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "var(--glass-bg-hover)";
                    e.target.style.borderColor =
                      "var(--modal-input-focus-border)";
                  }}
                  onBlur={(e) => {
                    e.target.style.background = "var(--modal-input-bg)";
                    e.target.style.borderColor = "var(--modal-input-border)";
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={isProcessing || !input.trim()}
                  style={{
                    padding: "10px 16px",
                    background:
                      isProcessing || !input.trim()
                        ? "rgba(139, 92, 246, 0.3)"
                        : "linear-gradient(135deg, rgba(139, 92, 246, 0.8) 0%, rgba(6, 182, 212, 0.8) 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor:
                      isProcessing || !input.trim() ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseOver={(e) => {
                    if (!isProcessing && input.trim()) {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(139, 92, 246, 0.4)";
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {isProcessing ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaRobot />
                  )}
                  {isProcessing ? t.generating : t.send}
                </button>
              </div>
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

        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3 {
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

        .markdown-content ul,
        .markdown-content ol {
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
          font-family: "Courier New", monospace;
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

        .markdown-content th,
        .markdown-content td {
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 6px 10px;
          text-align: left;
        }

        .markdown-content th {
          background: rgba(255, 255, 255, 0.1);
          font-weight: 600;
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
