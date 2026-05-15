"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import useScrollLock from "@/hooks/useScrollLock";
import { DEFAULT_REMINDER_MODEL_ID } from "@/lib/ai/modelIds";
import { MUTATION_TOOLS, getToolName, isToolPart } from "./ai-modal/toolHelpers";
import ModalHeader from "./ai-modal/ModalHeader";
import MessageList from "./ai-modal/MessageList";
import InputBar from "./ai-modal/InputBar";

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
    model: DEFAULT_REMINDER_MODEL_ID,
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

  const t = useTranslations("aiModal");

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
          label: t("suggestion.listToday"),
          prompt: zh ? "列出今天的提醒" : "List today's reminders",
        },
        {
          label: t("suggestion.createAnother"),
          prompt: zh ? "再建立一個提醒" : "Create another reminder",
        },
        {
          label: t("suggestion.findConflicts"),
          prompt: zh ? "檢查時間衝突" : "Check for time conflicts",
        },
      ],
      listReminders: [
        {
          label: t("suggestion.summarize"),
          prompt: zh ? "總結這些提醒" : "Summarize these reminders",
        },
        {
          label: t("suggestion.findConflicts"),
          prompt: zh ? "檢查時間衝突" : "Check for time conflicts",
        },
        {
          label: t("suggestion.analyzePatterns"),
          prompt: zh ? "分析我的提醒模式" : "Analyze my reminder patterns",
        },
      ],
      deleteReminder: [
        {
          label: t("suggestion.listRemaining"),
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
        {
          label: t("suggestion.createNew"),
          prompt: zh ? "建立一個新提醒" : "Create a new reminder",
        },
      ],
      analyzePatterns: [
        {
          label: t("suggestion.thisWeek"),
          prompt: zh ? "總結本週的任務" : "Summarize this week's tasks",
        },
        {
          label: t("suggestion.listAll"),
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
      ],
      updateReminder: [
        {
          label: t("suggestion.viewAll"),
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
        {
          label: t("suggestion.findConflicts"),
          prompt: zh ? "檢查時間衝突" : "Check for time conflicts",
        },
      ],
    };
    return (
      actions[toolName] || [
        {
          label: t("suggestion.listReminders"),
          prompt: zh ? "列出所有提醒" : "List all reminders",
        },
        {
          label: t("suggestion.createReminder"),
          prompt: zh ? "建立一個提醒" : "Create a reminder",
        },
        {
          label: t("suggestion.analyze"),
          prompt: zh ? "分析我的提醒模式" : "Analyze my patterns",
        },
      ]
    );
  }, [messages, isProcessing, settings.language, t]);

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
        model: parsed.model || DEFAULT_REMINDER_MODEL_ID,
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
    if (window.confirm(t("confirmClear"))) {
      setMessages([]);
    }
  }, [setMessages, t]);

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
        <ModalHeader
          isMobile={isMobile}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          showModelDropdown={showModelDropdown}
          setShowModelDropdown={setShowModelDropdown}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          supportsReasoning={supportsReasoning}
          supportsReasoningToggle={supportsReasoningToggle}
          hasMessages={messages.length > 0}
          onClearChat={handleClearChat}
          onClose={handleAnimatedClose}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: isMobile ? "calc(100vh - 42px)" : "calc(85vh - 42px)",
          }}
        >
          <MessageList
            messages={messages}
            isProcessing={isProcessing}
            initialText={initialText}
            language={settings.language}
            onSelectPrompt={setInput}
            messagesEndRef={messagesEndRef}
          />
          <InputBar
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isProcessing={isProcessing}
            errorMessage={errorMessage}
            suggestions={suggestions}
            hasMessages={messages.length > 0}
          />
        </div>
      </div>
    </>
  );
}
