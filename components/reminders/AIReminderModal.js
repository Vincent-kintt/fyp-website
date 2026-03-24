"use client";

import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { FaSpinner, FaTimes, FaTrash, FaCheck, FaRobot } from "react-icons/fa";
import AgentStepIndicator from "./AgentStepIndicator";
import AgentThinkingIndicator from "./AgentThinkingIndicator";
import AgentActivityLog from "./AgentActivityLog";
import ToolResultCard from "./ToolResultCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Button from "../ui/Button";

// Suggested follow-up actions based on last tool used
function getSuggestedActions(agentMessages, language) {
  if (!agentMessages.length) return [];
  const lastMsg = agentMessages[agentMessages.length - 1];
  if (!lastMsg?.timeline || lastMsg.isStreaming) return [];

  // Find the last tool call in the timeline
  const toolBlocks = lastMsg.timeline.filter(b => b.type === "tool" && b.status === "success");
  if (!toolBlocks.length) return [];
  const lastTool = toolBlocks[toolBlocks.length - 1].tool;

  const zh = language === "zh";
  const actions = {
    createReminder: [
      { label: zh ? "查看今天" : "List today's", prompt: zh ? "列出今天的提醒" : "List today's reminders" },
      { label: zh ? "再建一個" : "Create another", prompt: zh ? "再建立一個提醒" : "Create another reminder" },
      { label: zh ? "檢查衝突" : "Find conflicts", prompt: zh ? "檢查時間衝突" : "Check for time conflicts" },
    ],
    listReminders: [
      { label: zh ? "摘要" : "Summarize", prompt: zh ? "總結這些提醒" : "Summarize these reminders" },
      { label: zh ? "檢查衝突" : "Find conflicts", prompt: zh ? "檢查時間衝突" : "Check for time conflicts" },
      { label: zh ? "分析模式" : "Analyze patterns", prompt: zh ? "分析我的提醒模式" : "Analyze my reminder patterns" },
    ],
    deleteReminder: [
      { label: zh ? "查看剩餘" : "List remaining", prompt: zh ? "列出所有提醒" : "List all reminders" },
      { label: zh ? "建立新的" : "Create new", prompt: zh ? "建立一個新提醒" : "Create a new reminder" },
    ],
    analyzePatterns: [
      { label: zh ? "本週摘要" : "This week", prompt: zh ? "總結本週的任務" : "Summarize this week's tasks" },
      { label: zh ? "列出全部" : "List all", prompt: zh ? "列出所有提醒" : "List all reminders" },
    ],
    updateReminder: [
      { label: zh ? "查看全部" : "List all", prompt: zh ? "列出所有提醒" : "List all reminders" },
      { label: zh ? "檢查衝突" : "Find conflicts", prompt: zh ? "檢查時間衝突" : "Check for time conflicts" },
    ],
  };
  return actions[lastTool] || [
    { label: zh ? "列出提醒" : "List reminders", prompt: zh ? "列出所有提醒" : "List all reminders" },
    { label: zh ? "建立提醒" : "Create reminder", prompt: zh ? "建立一個提醒" : "Create a reminder" },
    { label: zh ? "分析模式" : "Analyze", prompt: zh ? "分析我的提醒模式" : "Analyze my patterns" },
  ];
}

// Generate a brief synthetic summary when the model doesn't produce a final content response
function generateToolSummary(tool, result, language) {
  const zh = language === "zh";
  if (!result) return null;
  switch (tool) {
    case "createReminder":
      return result.reminder?.title
        ? (zh ? `已為你建立提醒「${result.reminder.title}」。` : `Created reminder: **${result.reminder.title}**.`)
        : null;
    case "updateReminder":
      return result.reminder?.title
        ? (zh ? `已更新提醒「${result.reminder.title}」。` : `Updated reminder: **${result.reminder.title}**.`)
        : null;
    case "deleteReminder":
      return zh ? "已刪除提醒。" : "Reminder deleted.";
    case "snoozeReminder":
      return result.snoozedMinutes
        ? (zh ? `已延後提醒 ${result.snoozedMinutes} 分鐘。` : `Snoozed for ${result.snoozedMinutes} minutes.`)
        : null;
    case "batchCreate":
      return result.count
        ? (zh ? `已批量建立 ${result.count} 個提醒。` : `Created ${result.count} reminders.`)
        : null;
    case "setQuickReminder":
      return result.reminder?.title
        ? (zh ? `快速提醒已設定：「${result.reminder.title}」。` : `Quick reminder set: **${result.reminder.title}**.`)
        : null;
    case "templateCreate":
      return result.reminder?.title
        ? (zh ? `已從模板建立「${result.reminder.title}」。` : `Created from template: **${result.reminder.title}**.`)
        : null;
    default:
      return null;
  }
}

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

export default function AIReminderModal({ isOpen, onClose, onSuccess, initialText = "" }) {
  const [text, setText] = useState(initialText);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [settings, setSettings] = useState({
    model: "x-ai/grok-4.1-fast",
    reasoningEffort: "medium",
    reasoningEnabled: true,
    language: "zh",
    reasoningLanguage: "zh"
  });
  const [agentSteps, setAgentSteps] = useState([]);
  const [agentMessages, setAgentMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [thinkingPhase, setThinkingPhase] = useState(null);
  const [currentToolCall, setCurrentToolCall] = useState(null);
  const [agentActivities, setAgentActivities] = useState([]);
  const [currentReasoning, setCurrentReasoning] = useState("");
  const [completedReasoning, setCompletedReasoning] = useState(""); // Saved after processing completes
  const [recentMutations, setRecentMutations] = useState([]); // Track recent successful mutations for UI feedback
  const [userLocation, setUserLocation] = useState(null); // User's location for context
  const messagesEndRef = useRef(null);
  const mutationToolsRef = useRef(new Set(["createReminder", "updateReminder", "deleteReminder", "batchCreate", "setQuickReminder", "templateCreate"]));
  const hasPendingRefreshRef = useRef(false); // Track if we need to refresh parent on close
  
  const t = translations[settings.language] || translations.zh;

  // Get user location on mount (with permission)
  useEffect(() => {
    const getLocation = async () => {
      // Check if we have cached location (valid for 1 hour)
      const cached = localStorage.getItem("user_location");
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // 1 hour
          setUserLocation(data);
          return;
        }
      }

      // Try browser Geolocation API first
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              // Reverse geocode to get city/region name
              const { latitude, longitude } = position.coords;
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=${settings.language === "zh" ? "zh-TW" : "en"}`
              );
              const data = await response.json();
              const locationData = {
                city: data.address?.city || data.address?.town || data.address?.village || data.address?.county,
                region: data.address?.state || data.address?.province,
                country: data.address?.country,
                latitude,
                longitude,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              };
              setUserLocation(locationData);
              localStorage.setItem("user_location", JSON.stringify({ data: locationData, timestamp: Date.now() }));
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
            // Fallback: Use timezone to infer general location
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setUserLocation({ timezone, inferred: true });
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 3600000 }
        );
      } else {
        // No geolocation support, use timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setUserLocation({ timezone, inferred: true });
      }
    };

    getLocation();
  }, [settings.language]);

  // Auto-clear old mutation notifications after 3 seconds
  useEffect(() => {
    if (recentMutations.length > 0) {
      const timer = setTimeout(() => {
        const now = Date.now();
        setRecentMutations(prev => prev.filter(m => now - m.timestamp < 3000));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [recentMutations]);

  // Get mutation message for display
  const getMutationMessage = (mutation) => {
    const messages = {
      createReminder: settings.language === "zh" ? "✅ 已新增提醒" : "✅ Reminder created",
      updateReminder: settings.language === "zh" ? "✅ 已更新提醒" : "✅ Reminder updated",
      deleteReminder: settings.language === "zh" ? "✅ 已刪除提醒" : "✅ Reminder deleted",
      batchCreate: settings.language === "zh" ? "✅ 已批量新增提醒" : "✅ Reminders created",
      setQuickReminder: settings.language === "zh" ? "✅ 已設定快速提醒" : "✅ Quick reminder set",
      templateCreate: settings.language === "zh" ? "✅ 已從範本建立提醒" : "✅ Created from template",
    };
    return messages[mutation.tool] || (settings.language === "zh" ? "✅ 操作成功" : "✅ Action completed");
  };

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

  // Store onSuccess in a ref so cleanup can access latest value
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // Handle component unmount - refresh if there were mutations
  // This catches navigation, page refresh, etc.
  useEffect(() => {
    return () => {
      if (hasPendingRefreshRef.current && onSuccessRef.current) {
        onSuccessRef.current();
        hasPendingRefreshRef.current = false;
      }
    };
  }, []);

  // Update text when initialText changes (from QuickAdd forward)
  useEffect(() => {
    if (initialText && isOpen) {
      setText(initialText);
    }
  }, [initialText, isOpen]);

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
      setError("");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      // Refresh parent list when modal closes normally
      if (hasPendingRefreshRef.current && onSuccess) {
        onSuccess();
        hasPendingRefreshRef.current = false;
      }
    }
  }, [isOpen, onSuccess]);

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
          userLocation, // Pass user location for context
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

                case "reasoning_hide":
                  // Collapse (not remove) reasoning when the model didn't produce content
                  // User can still expand to see the reasoning if they want
                  setAgentMessages(prev => {
                    const updated = [...prev];
                    const lastMsgIdx = updated.length - 1;
                    if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                      const timeline = [...(updated[lastMsgIdx].timeline || [])];
                      const reasoningIdx = timeline.findIndex(
                        b => b.type === "reasoning" && b.iteration === event.iteration
                      );
                      if (reasoningIdx >= 0) {
                        // If reasoning has actual content, collapse it; if empty, remove it
                        if (timeline[reasoningIdx].content?.trim()) {
                          timeline[reasoningIdx] = { ...timeline[reasoningIdx], completed: true, expanded: false };
                        } else {
                          timeline.splice(reasoningIdx, 1);
                        }
                      }
                      updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                    }
                    return updated;
                  });
                  break;

                case "reasoning":
                case "reasoning_complete":
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
                          // For reasoning_complete, always use the full iterationReasoning
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
                        iteration: event.iteration,
                        startTime: Date.now()
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
                         const elapsed = timeline[toolBlockIdx].startTime ? Date.now() - timeline[toolBlockIdx].startTime : null;
                         timeline[toolBlockIdx] = {
                           ...timeline[toolBlockIdx],
                           status: event.success ? "success" : "error",
                           result: event.result,
                           duration: elapsed,
                           ...(event.success ? {} : { error: event.result?.error })
                         };
                      }
                      updated[lastMsgIdx] = { ...updated[lastMsgIdx], timeline };
                    }
                    return updated;
                  });
                  
                  // If this is a mutation tool that succeeded, mark for refresh on close
                  if (event.success && event.tool && mutationToolsRef.current.has(event.tool)) {
                    // Track mutation for visual feedback
                    setRecentMutations(prev => [...prev, {
                      tool: event.tool,
                      result: event.result,
                      timestamp: Date.now()
                    }]);
                    
                    // Mark that we need to refresh parent when modal closes
                    // This prevents losing agent context from immediate refresh
                    hasPendingRefreshRef.current = true;
                  }
                  
                  setCurrentToolCall(null);
                  break;
                  
                case "tool_error":
                   // Update tool block to error with error message
                   setAgentMessages(prev => {
                    const updated = [...prev];
                    const lastMsgIdx = updated.length - 1;
                    if (lastMsgIdx >= 0 && updated[lastMsgIdx].type === "agent") {
                      const timeline = [...(updated[lastMsgIdx].timeline || [])];
                      const toolBlockIdx = timeline.map(b => b.type).lastIndexOf("tool");
                      if (toolBlockIdx >= 0) {
                         timeline[toolBlockIdx] = { ...timeline[toolBlockIdx], status: "error", error: event.error || event.message };
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

                       // If timeline has no content block after the last tool call,
                       // inject a synthetic summary so the user sees a final response
                       const hasContentAfterLastTool = (() => {
                         const lastToolIdx = timeline.map(b => b.type).lastIndexOf("tool");
                         if (lastToolIdx < 0) return true;
                         return timeline.slice(lastToolIdx + 1).some(b => b.type === "content");
                       })();
                       if (!hasContentAfterLastTool) {
                         const lastToolBlock = [...timeline].reverse().find(b => b.type === "tool" && b.status === "success");
                         if (lastToolBlock) {
                           const summaryText = generateToolSummary(lastToolBlock.tool, lastToolBlock.result, settings.language);
                           if (summaryText) {
                             timeline.push({
                               type: "content",
                               content: summaryText,
                               iteration: lastToolBlock.iteration,
                               synthetic: true,
                             });
                           }
                         }
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

  const handleClearChat = () => {
    if (window.confirm(t.confirmClear)) {
      setAgentMessages([]);
      setAgentSteps([]);
      setSuggestions([]);
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
        className={isMobile ? "fixed inset-0 z-[9999]" : "fixed z-[9999] w-[900px] max-h-[85vh] shadow-2xl"}
        style={{
          position: "fixed",
          ...(isMobile ? {} : { left: `${position.x}px`, top: `${position.y}px` }),
          borderRadius: isMobile ? "0" : "20px",
          background: "var(--modal-bg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: isMobile ? "none" : "1px solid var(--modal-border)",
          boxShadow: isMobile ? "none" : "var(--modal-shadow)",
          transition: isDragging ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(-10px)",
          opacity: isOpen ? 1 : 0,
        }}
        onMouseDown={isMobile ? undefined : handleMouseDown}
      >
        <div className={`modal-header flex items-center justify-between ${isMobile ? "" : "cursor-move"} select-none`} style={{ padding: "10px 12px", borderRadius: isMobile ? "0" : "20px 20px 0 0", background: "var(--modal-header-bg)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--modal-header-border)" }}>
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
                minWidth: "140px"
              }}
            >
              {modelOptions.map(option => (
                <option key={option.value} value={option.value} style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>
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
                  minWidth: "60px"
                }}
              >
                <option value="low" style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>{t.low}</option>
                <option value="medium" style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>{t.medium}</option>
                <option value="high" style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>{t.high}</option>
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
                  minWidth: "60px"
                }}
              >
                <option value="true" style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>{t.enabled}</option>
                <option value="false" style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>{t.disabled}</option>
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
                minWidth: "80px"
              }}
            >
              <option value="zh" style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>繁體中文</option>
              <option value="en" style={{ background: "var(--select-option-bg)", color: "var(--modal-text)" }}>English</option>
            </select>

          </div>

          <button
            onClick={onClose}
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
              flexShrink: 0
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
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", height: isMobile ? "calc(100vh - 52px)" : "calc(85vh - 60px)", padding: isMobile ? "8px" : "16px" }}>
          {/* Chat Area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--glass-bg)", borderRadius: isMobile ? "8px" : "12px", border: "1px solid var(--glass-border)" }}>
            {/* 對話標題和清空按鈕 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--glass-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FaRobot style={{ color: "var(--modal-accent)", fontSize: "16px" }} />
                <h3 style={{ fontSize: "15px", fontWeight: "600", color: "var(--modal-text)" }}>
                  {t.chatTitle}
                </h3>
              </div>
              {agentMessages.length > 0 && (
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
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "var(--tool-error-border)";
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

            {/* 對話訊息列表 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {agentMessages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--modal-text-muted)" }}>
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
                          <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "10px 14px", background: "var(--user-bubble-bg)", border: "1px solid var(--user-bubble-border)", borderRadius: "12px 12px 2px 12px", fontSize: "13px", color: "var(--modal-text)" }}>
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
                                      background: "var(--glass-border)", 
                                      borderRadius: "4px", 
                                      fontSize: "11px", 
                                      fontWeight: "600",
                                      color: "var(--modal-text)"
                                    }}>
                                      Step {block.iteration}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "var(--modal-text-muted)" }}>
                                      {block.title}
                                    </div>
                                    <div style={{ flex: 1, height: "1px", background: "var(--glass-border)" }}></div>
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
                                      background: "var(--glass-bg)",
                                      border: "1px solid var(--glass-border)",
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
                                          <FaSpinner className="animate-spin" style={{ color: "var(--modal-accent)", fontSize: "14px" }} />
                                        ) : block.status === "success" ? (
                                          <FaCheck style={{ color: "var(--success)", fontSize: "14px" }} />
                                        ) : (
                                          <FaTimes style={{ color: "var(--danger)", fontSize: "14px" }} />
                                        )}
                                      </div>
                                      
                                      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                        <span style={{ fontSize: "13px", color: "var(--modal-text)", fontWeight: "500" }}>
                                          {block.description || block.tool}
                                        </span>
                                        <span style={{ fontSize: "11px", color: "var(--modal-text-muted)" }}>
                                          {block.status === "running"
                                            ? (settings.language === "en" ? "Executing..." : "執行中...")
                                            : block.status === "success"
                                              ? (settings.language === "en" ? "Completed" : "已完成") + (block.duration ? ` - ${(block.duration / 1000).toFixed(1)}s` : "")
                                              : (settings.language === "en" ? "Failed" : "失敗") + (block.duration ? ` - ${(block.duration / 1000).toFixed(1)}s` : "")}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Tool Result Details */}
                                    {(block.status === "success" || block.status === "error") && (
                                      <div style={{ marginLeft: "4px" }}>
                                        <ToolResultCard
                                          tool={block.tool}
                                          result={block.result}
                                          input={block.input}
                                          success={block.status === "success"}
                                          error={block.error}
                                          language={settings.language}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (block.type === "content") {
                                // Filter out any remaining tool markup that might have slipped through
                                const cleanContent = (block.content || "")
                                  .replace(/<!--TOOL:[\w]+:[\s\S]*?-->/g, "")
                                  .replace(/<!--TOOL[^>]*$/g, "")
                                  .trim();
                                
                                if (!cleanContent) return null;
                                
                                return (
                                  <div key={`content-${bIdx}`} className="markdown-content" style={{ padding: "12px 16px", background: "var(--agent-bubble-bg)", border: "1px solid var(--agent-bubble-border)", borderRadius: "12px 12px 12px 2px", fontSize: "13px", color: "var(--modal-text)" }}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
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
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--glass-border)" }}>
              {error && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#ef4444", background: "var(--tool-error-bg)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--tool-error-border)", marginBottom: "8px" }}>
                  <span>{error}</span>
                  <button onClick={() => setError(null)} style={{ cursor: "pointer", padding: "2px 6px", background: "none", border: "none", color: "#ef4444", fontSize: "14px", lineHeight: 1 }}>×</button>
                </div>
              )}
              {/* Suggested Actions */}
              {!isGenerating && agentMessages.length > 0 && (() => {
                const suggestions = getSuggestedActions(agentMessages, settings.language);
                if (!suggestions.length) return null;
                return (
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", overflowX: "auto", paddingBottom: "2px" }}>
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => setText(s.prompt)}
                        style={{
                          padding: "5px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: "500",
                          background: "var(--glass-bg)", color: "var(--modal-accent)", border: "1px solid var(--glass-border)",
                          cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.borderColor = "var(--modal-accent-border)"; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.borderColor = "var(--glass-border)"; }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
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
                    background: "var(--modal-input-bg)",
                    border: "1px solid var(--modal-input-border)",
                    borderRadius: "10px",
                    color: "var(--modal-text)",
                    fontSize: "13px",
                    outline: "none",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    resize: "none"
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "var(--glass-bg-hover)";
                    e.target.style.borderColor = "var(--modal-input-focus-border)";
                  }}
                  onBlur={(e) => {
                    e.target.style.background = "var(--modal-input-bg)";
                    e.target.style.borderColor = "var(--modal-input-border)";
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
        
        .mutation-toast {
          animation: slideInUp 0.3s ease-out, fadeOut 0.3s ease-out 2.7s forwards;
        }
      `}</style>
      
      {/* Mutation Success Toasts */}
      {recentMutations.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-2">
          {recentMutations.map((mutation, idx) => (
            <div
              key={mutation.timestamp + idx}
              className="mutation-toast px-4 py-3 rounded-xl shadow-lg"
              style={{
                background: "rgba(34, 197, 94, 0.15)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                color: "rgba(134, 239, 172, 1)",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {getMutationMessage(mutation)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
