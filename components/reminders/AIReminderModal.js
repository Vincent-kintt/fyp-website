"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FaSpinner,
  FaTimes,
  FaCheck,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import ToolResultCard from "./ToolResultCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useScrollLock from "@/hooks/useScrollLock";

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
  {
    value: "x-ai/grok-4.1-fast",
    label: "Grok 4.1 Fast",
    desc: "Fast, great at tool use",
  },
  {
    value: "deepseek/deepseek-v3.2",
    label: "DeepSeek V3.2",
    desc: "Open-weight, good at Chinese",
  },
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

function getToolDescription(toolName, state, output) {
  if (state === "input-streaming" || state === "input-available") {
    const labels = {
      createReminder: "Creating reminder",
      updateReminder: "Updating reminder",
      deleteReminder: "Deleting reminder",
      batchCreate: "Creating multiple reminders",
      listReminders: "Fetching reminders",
      findConflicts: "Checking for conflicts",
      analyzePatterns: "Analyzing patterns",
      summarizeUpcoming: "Summarizing upcoming tasks",
      suggestReminders: "Generating suggestions",
      snoozeReminder: "Snoozing reminder",
      setQuickReminder: "Setting quick reminder",
      templateCreate: "Creating from template",
      exportReminders: "Exporting reminders",
      askClarification: "Asking for clarification",
      searchWeb: "Searching the web",
    };
    return labels[toolName] || `Running ${toolName}`;
  }
  if (output?.success === false) return `${toolName} failed`;
  switch (toolName) {
    case "createReminder":
      return `Created ${output?.reminder?.title || "reminder"}`;
    case "updateReminder":
      return `Updated ${output?.reminder?.title || "reminder"}`;
    case "deleteReminder":
      return "Deleted reminder";
    case "batchCreate":
      return `Created ${output?.count || ""} reminders`;
    case "listReminders":
      return `Listed ${output?.count || ""} reminders`;
    case "findConflicts":
      return output?.hasConflicts
        ? `Found ${output.conflicts?.length} conflicts`
        : "No conflicts found";
    case "analyzePatterns":
      return "Analysis complete";
    case "summarizeUpcoming":
      return `${output?.total || ""} upcoming tasks`;
    case "suggestReminders":
      return "Suggestions ready";
    case "snoozeReminder":
      return `Snoozed ${output?.snoozedMinutes || ""} minutes`;
    case "setQuickReminder":
      return "Quick reminder set";
    case "templateCreate":
      return "Created from template";
    case "exportReminders":
      return `Exported (${output?.format || "json"})`;
    case "askClarification":
      return "Need more info";
    case "searchWeb":
      return "Search complete";
    default:
      return `${toolName} completed`;
  }
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

function ToolInvocationBlock({ part, language }) {
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

function ModelDropdown({ model, onChange, isOpen, onToggle }) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        width: "260px",
        background: "var(--modal-bg, #111)",
        border: "1px solid var(--glass-border)",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "6px",
        zIndex: 20,
      }}
    >
      {modelOptions.map((opt) => (
        <div
          key={opt.value}
          onClick={() => {
            onChange(opt.value);
            onToggle();
          }}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            cursor: "pointer",
            marginBottom: "4px",
            background:
              model === opt.value ? "var(--glass-bg-hover)" : "transparent",
            border:
              model === opt.value
                ? "1px solid var(--glass-border-hover)"
                : "1px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "13px",
                color: "var(--modal-text)",
                fontWeight: 500,
              }}
            >
              {opt.label}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--modal-text-muted)",
                marginTop: "2px",
              }}
            >
              {opt.desc}
            </div>
          </div>
          {model === opt.value && (
            <FaCheck
              style={{ color: "var(--modal-text-secondary)", fontSize: "12px", flexShrink: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsPopover({
  settings,
  onChange,
  isOpen,
  supportsReasoning,
  supportsReasoningToggle,
  language,
}) {
  if (!isOpen) return null;
  const zh = language === "zh";
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        right: 0,
        width: "280px",
        background: "var(--modal-bg, #111)",
        border: "1px solid var(--glass-border)",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "4px",
        zIndex: 20,
      }}
    >
      {(supportsReasoning || supportsReasoningToggle) && (
        <div style={{ padding: "14px 16px" }}>
          <div
            style={{
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            {zh ? "推理設定" : "Reasoning"}
          </div>
          {supportsReasoningToggle && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: supportsReasoning ? "12px" : 0,
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--modal-text)" }}>
                {zh ? "推理模式" : "Reasoning mode"}
              </span>
              <div
                onClick={() =>
                  onChange({ reasoningEnabled: !settings.reasoningEnabled })
                }
                style={{
                  width: "40px",
                  height: "22px",
                  borderRadius: "11px",
                  background: settings.reasoningEnabled
                    ? "var(--modal-text-muted)"
                    : "var(--glass-border)",
                  padding: "2px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#fff",
                    marginLeft: settings.reasoningEnabled ? "auto" : "0",
                    transition: "margin 0.2s",
                  }}
                />
              </div>
            </div>
          )}
          {supportsReasoning && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--modal-text)" }}>
                {zh ? "強度" : "Effort"}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["low", "medium", "high"].map((level) => (
                  <div
                    key={level}
                    onClick={() => onChange({ reasoningEffort: level })}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      cursor: "pointer",
                      color:
                        settings.reasoningEffort === level
                          ? "var(--modal-text-secondary)"
                          : "var(--modal-text-muted)",
                      background:
                        settings.reasoningEffort === level
                          ? "var(--glass-bg-hover)"
                          : "var(--glass-bg)",
                      border: `1px solid ${settings.reasoningEffort === level ? "var(--glass-border-hover)" : "var(--glass-border)"}`,
                    }}
                  >
                    {level === "low"
                      ? zh
                        ? "低"
                        : "Low"
                      : level === "medium"
                        ? zh
                          ? "中"
                          : "Med"
                        : zh
                          ? "高"
                          : "High"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {(supportsReasoning || supportsReasoningToggle) && (
        <div
          style={{
            height: "1px",
            background: "var(--glass-border)",
            margin: "0 16px",
          }}
        />
      )}
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            fontSize: "10px",
            color: "var(--modal-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          {zh ? "語言" : "Language"}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {[
            { value: "zh", label: "繁體中文" },
            { value: "en", label: "English" },
          ].map((lang) => (
            <div
              key={lang.value}
              onClick={() => onChange({ language: lang.value })}
              style={{
                flex: 1,
                padding: "6px 16px",
                borderRadius: "8px",
                fontSize: "12px",
                textAlign: "center",
                cursor: "pointer",
                color:
                  settings.language === lang.value
                    ? "var(--modal-text-secondary)"
                    : "var(--modal-text-muted)",
                background:
                  settings.language === lang.value
                    ? "var(--glass-bg-hover)"
                    : "var(--glass-bg)",
                border: `1px solid ${settings.language === lang.value ? "var(--glass-border-hover)" : "var(--glass-border)"}`,
              }}
            >
              {lang.label}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          height: "1px",
          background: "var(--glass-border)",
          margin: "0 16px",
        }}
      />
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--modal-text-muted)" }}>
          {zh ? "開啟 AI 對話" : "Open AI Chat"}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <span
            style={{
              padding: "2px 6px",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "4px",
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              fontFamily: "monospace",
            }}
          >
            {typeof navigator !== "undefined" &&
            navigator?.platform?.includes("Mac")
              ? "Cmd"
              : "Ctrl"}
          </span>
          <span
            style={{
              padding: "2px 6px",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "4px",
              fontSize: "10px",
              color: "var(--modal-text-muted)",
              fontFamily: "monospace",
            }}
          >
            J
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AIReminderModal({
  isOpen,
  onClose,
  onSuccess,
  initialText = "",
}) {
  useScrollLock(isOpen);
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
          reasoningEnabled: settingsRef.current.reasoningEnabled,
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
        x: mobile ? 0 : (windowWidth - 720) / 2,
        y: mobile ? 0 : windowHeight * 0.1,
      });
    } else {
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

  const handleSettingsChange = (patch) => {
    const newSettings = { ...settings, ...patch };
    setSettings(newSettings);
    localStorage.setItem("ai_reminder_settings", JSON.stringify(newSettings));
  };

  const isGeminiModel = settings.model.includes("gemini");
  const isGrokModel = settings.model.includes("grok");
  const isDeepSeekModel = settings.model.includes("deepseek");
  const supportsReasoningToggle = isGrokModel || isDeepSeekModel;
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const supportsReasoning = isGeminiModel;
  const currentModelLabel =
    modelOptions.find((o) => o.value === settings.model)?.label || "Model";

  useEffect(() => {
    if (!showModelDropdown && !showSettings) return;
    const handleClick = (e) => {
      if (
        !e.target.closest(".model-dropdown-anchor") &&
        !e.target.closest(".settings-anchor")
      ) {
        setShowModelDropdown(false);
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showModelDropdown, showSettings]);

  // Error display: combine chatError with any local display need
  const errorMessage = chatError?.message || null;

  if (!shouldRender) return null;

  const emptyStateSuggestions = [
    {
      zh: "建立提醒",
      en: "Create a reminder",
      prompt: settings.language === "zh" ? "建立一個提醒" : "Create a reminder",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      zh: "今天的行程",
      en: "Today's schedule",
      prompt: settings.language === "zh" ? "列出今天的提醒" : "List today's reminders",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      zh: "規劃本週",
      en: "Plan the week",
      prompt: settings.language === "zh" ? "幫我規劃本週" : "Help me plan this week",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      zh: "分析模式",
      en: "Analyze patterns",
      prompt: settings.language === "zh" ? "分析我的提醒模式" : "Analyze my reminder patterns",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
  ];

  const headerBtnStyle = {
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "var(--modal-text-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.12s, background 0.12s",
  };

  return (
    <>
      <div
        className={`${isMobile ? "fixed inset-0 z-[9999]" : "fixed z-[9999] w-[720px] max-h-[85vh] shadow-2xl"} ${isClosing ? "modal-panel-exit" : "modal-panel-enter"}`}
        style={{
          position: "fixed",
          ...(isMobile
            ? {}
            : { left: `${position.x}px`, top: `${position.y}px` }),
          borderRadius: isMobile ? "0" : "14px",
          background: "var(--modal-bg)",
          border: isMobile ? "none" : "1px solid var(--modal-border)",
          boxShadow: isMobile ? "none" : "var(--modal-shadow)",
        }}
        onMouseDown={isMobile ? undefined : handleMouseDown}
      >
        {/* ===== Header ===== */}
        <div
          className={`modal-header flex items-center ${isMobile ? "" : "cursor-move"} select-none`}
          style={{
            padding: "0 14px",
            height: "42px",
            borderRadius: isMobile ? "0" : "14px 14px 0 0",
            borderBottom: "1px solid var(--modal-header-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: 1,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--modal-text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {settings.language === "zh" ? "提醒助手" : "Reminders"}
            </span>
            <div
              style={{
                width: "1px",
                height: "14px",
                background: "var(--glass-border)",
                flexShrink: 0,
              }}
            />
            <div
              className="model-dropdown-anchor"
              style={{ position: "relative" }}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModelDropdown(!showModelDropdown);
                  setShowSettings(false);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  background: "var(--glass-bg)",
                  color: "var(--modal-text-muted)",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  maxWidth: isMobile ? "100px" : "none",
                  transition: "color 0.12s, background 0.12s",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentModelLabel}
                </span>
                <FaChevronDown style={{ fontSize: "7px", flexShrink: 0, opacity: 0.5 }} />
              </div>
              <ModelDropdown
                model={settings.model}
                onChange={(model) => handleSettingsChange({ model })}
                isOpen={showModelDropdown}
                onToggle={() => setShowModelDropdown(false)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "1px", flexShrink: 0 }}>
            <div className="settings-anchor" style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowModelDropdown(false);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={headerBtnStyle}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </button>
              <SettingsPopover
                settings={settings}
                onChange={handleSettingsChange}
                isOpen={showSettings}
                supportsReasoning={supportsReasoning}
                supportsReasoningToggle={supportsReasoningToggle}
                language={settings.language}
              />
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                onMouseDown={(e) => e.stopPropagation()}
                style={headerBtnStyle}
              >
                <FaTrash style={{ fontSize: "11px" }} />
              </button>
            )}
            <button
              onClick={handleAnimatedClose}
              onMouseDown={(e) => e.stopPropagation()}
              style={headerBtnStyle}
            >
              <FaTimes style={{ fontSize: "11px" }} />
            </button>
          </div>
        </div>

        {/* ===== Content area ===== */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: isMobile ? "calc(100vh - 42px)" : "calc(85vh - 42px)",
          }}
        >
          {/* Message list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {initialText && messages.length <= 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px",
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "6px",
                  alignSelf: "flex-start",
                  marginBottom: "4px",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--modal-text-muted)" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span style={{ fontSize: "10px", color: "var(--modal-text-muted)" }}>
                  {settings.language === "zh" ? "從 QuickAdd 繼續" : "Continued from QuickAdd"}
                </span>
              </div>
            )}

            {messages.length === 0 ? (
              /* ===== Empty state ===== */
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "24px",
                  padding: "32px",
                }}
              >
                <p
                  style={{
                    fontSize: "15px",
                    color: "var(--modal-text-muted)",
                    textAlign: "center",
                  }}
                >
                  {settings.language === "zh" ? "需要什麼幫助？" : "What do you need?"}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    width: "100%",
                    maxWidth: "340px",
                  }}
                >
                  {emptyStateSuggestions.map((item) => (
                    <button
                      key={item.en}
                      onClick={() => setInput(item.prompt)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.12s",
                        width: "100%",
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = "var(--glass-bg)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "7px",
                          background: "var(--glass-bg)",
                          border: "1px solid var(--glass-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--modal-text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {item.icon}
                      </div>
                      <span style={{ fontSize: "13px", color: "var(--modal-text-secondary)", flex: 1 }}>
                        {settings.language === "zh" ? item.zh : item.en}
                      </span>
                      <span style={{ color: "var(--glass-border)", fontSize: "14px" }}>&#x203A;</span>
                    </button>
                  ))}
                </div>
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
                      /* User message — right aligned chip */
                      <div
                        style={{
                          alignSelf: "flex-end",
                          maxWidth: "75%",
                          padding: "9px 14px",
                          background: "var(--user-bubble-bg)",
                          border: "1px solid var(--user-bubble-border)",
                          borderRadius: "12px 12px 4px 12px",
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
                      /* Assistant message — flat layout, no bubble */
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          alignSelf: "flex-start",
                          maxWidth: "88%",
                          width: "100%",
                        }}
                      >
                        {msg.parts?.map((part, pIdx) => {
                          if (part.type === "step-start") {
                            return null;
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
                                  padding: "2px 0 2px 4px",
                                  fontSize: "13px",
                                  color: "var(--modal-text-secondary)",
                                  lineHeight: "1.7",
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

                {/* Streaming indicator */}
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
                          gap: "6px",
                          padding: "2px 4px",
                          color: "var(--modal-text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "3px" }}>
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              style={{
                                width: "4px",
                                height: "4px",
                                borderRadius: "50%",
                                background: "var(--modal-text-muted)",
                                animation: "pulse 1.4s infinite",
                                animationDelay: `${i * 0.2}s`,
                                opacity: 0.3,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ===== Input area ===== */}
          <div
            style={{
              padding: "10px 14px",
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
            {/* Suggested follow-ups — ghost buttons */}
            {!isProcessing &&
              messages.length > 0 &&
              suggestions.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "5px",
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
                        padding: "5px 11px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        background: "transparent",
                        color: "var(--modal-text-muted)",
                        border: "1px solid var(--glass-border)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.12s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "var(--glass-bg)";
                        e.currentTarget.style.borderColor = "var(--glass-border-hover)";
                        e.currentTarget.style.color = "var(--modal-text-secondary)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "var(--glass-border)";
                        e.currentTarget.style.color = "var(--modal-text-muted)";
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
                data-testid="ai-modal-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  isProcessing
                    ? settings.language === "zh" ? "等待回應中..." : "Waiting for response..."
                    : settings.language === "zh" ? "描述你的需求..." : "Describe what you need..."
                }
                rows="2"
                maxLength={2000}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: "var(--modal-input-bg)",
                  border: "1px solid var(--modal-input-border)",
                  borderRadius: "10px",
                  color: isProcessing ? "var(--modal-text-muted)" : "var(--modal-text)",
                  fontSize: "13px",
                  outline: "none",
                  transition: "border-color 0.15s",
                  fontFamily: "inherit",
                  resize: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--modal-input-focus-border)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--modal-input-border)";
                }}
              />
              {isProcessing ? (
                <button
                  onClick={() => {/* stop is handled by useChat */}}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--glass-bg)",
                    color: "var(--modal-text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "none",
                    background: input.trim() ? "var(--modal-text)" : "var(--glass-bg)",
                    color: input.trim() ? "var(--modal-bg)" : "var(--modal-text-muted)",
                    cursor: input.trim() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.12s",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
