"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FaPlus,
  FaCalendarAlt,
  FaTag,
  FaRobot,
  FaTimes,
  FaFlag,
  FaClock,
  FaSpinner,
} from "react-icons/fa";
import { getTagClasses, formatDuration, DURATION_PRESETS } from "@/lib/utils";
import { PRIORITY } from "@/lib/taskConfig";

const DEBOUNCE_MS = 600;

export default function QuickAdd({
  onAdd,
  onOpenAI,
  placeholder = "Add a task...",
  language = "zh",
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [newTag, setNewTag] = useState("");
  const [inlineResult, setInlineResult] = useState(null);
  const [showEscalation, setShowEscalation] = useState(false);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const t =
    {
      zh: {
        placeholder: "快速新增任務...",
        add: "新增",
        adding: "新增中...",
        cancel: "取消",
        aiAssist: "AI 助手",
        parsing: "AI 解析中...",
        setDate: "設定日期",
        setTag: "新增標籤",
        removeTag: "移除標籤",
        removePriority: "移除優先級",
        removeDate: "移除日期",
        tagPlaceholder: "輸入標籤...",
        parsingHint: "等待解析完成可獲得更準確的結果",
        today: "今天",
        tomorrow: "明天",
      },
      en: {
        placeholder: "Quick add task...",
        add: "Add",
        adding: "Adding...",
        cancel: "Cancel",
        aiAssist: "AI Assistant",
        parsing: "AI parsing...",
        setDate: "Set date",
        setTag: "Add tag",
        removeTag: "Remove tag",
        removePriority: "Remove priority",
        removeDate: "Remove date",
        tagPlaceholder: "Enter tag...",
        parsingHint: "Wait for parsing for better results",
        today: "Today",
        tomorrow: "Tomorrow",
      },
    }[language] || {};

  // Debounced NLP parsing
  const parseInput = useCallback(
    async (text) => {
      if (!text.trim() || text.length < 3) {
        setParsedData(null);
        return;
      }

      setIsParsing(true);
      try {
        const response = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setParsedData(result.data);
          }
        }
      } catch (error) {
        console.error("Parse error:", error);
      } finally {
        setIsParsing(false);
      }
    },
    [language],
  );

  const COMPLEX_PATTERNS =
    /\b(plan|reschedule|move all|help me|check conflicts|reorganize|analyze|summarize|review|suggest)\b/i;

  const isComplexRequest = (text) => {
    if (text.length > 80) return true;
    return COMPLEX_PATTERNS.test(text);
  };

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);
    setInlineResult(null);

    if (isComplexRequest(value)) {
      setShowEscalation(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setParsedData(null);
      setIsParsing(false);
      return;
    }

    setShowEscalation(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      parseInput(value);
    }, DEBOUNCE_MS);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Build final task data from parsed + manual overrides
  const buildTaskData = () => {
    const data = {
      title: parsedData?.title || inputText.trim(),
      tags: parsedData?.tags || [],
      priority: parsedData?.priority || "medium",
      status: "pending",
    };

    // Date/time - use manual override or parsed
    if (manualDate) {
      data.dateTime = manualTime
        ? `${manualDate}T${manualTime}`
        : `${manualDate}T09:00`;
    } else if (parsedData?.dateTime) {
      data.dateTime = parsedData.dateTime;
    } else {
      // Default to end of today so the task appears in Today without being immediately overdue
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 0, 0);
      data.dateTime = endOfDay.toISOString();
    }

    // Duration
    if (parsedData?.duration) {
      data.duration = parsedData.duration;
    }

    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsSubmitting(true);
    try {
      const taskData = buildTaskData();
      await onAdd(taskData);

      setInlineResult({
        title: taskData.title,
        dateTime: taskData.dateTime,
      });

      setInputText("");
      setParsedData(null);
      setManualDate("");
      setManualTime("");
      setShowDatePicker(false);
      setShowTagInput(false);
      setShowEscalation(false);

      setTimeout(() => {
        setInlineResult(null);
        setIsExpanded(false);
      }, 5000);
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setInputText("");
    setParsedData(null);
    setManualDate("");
    setManualTime("");
    setShowDatePicker(false);
    setShowTagInput(false);
    setInlineResult(null);
    setShowEscalation(false);
  };

  const handleForwardToAI = () => {
    if (onOpenAI) {
      onOpenAI(inputText);
    }
    handleCancel();
  };

  // Chip removal handlers
  const removeTag = (tagToRemove) => {
    setParsedData((prev) => ({
      ...prev,
      tags: (prev?.tags || []).filter((t) => t !== tagToRemove),
    }));
  };

  const removePriority = () => {
    setParsedData((prev) => ({ ...prev, priority: null }));
  };

  const removeDateTime = () => {
    setParsedData((prev) => ({ ...prev, dateTime: null }));
    setManualDate("");
    setManualTime("");
  };

  const addTag = (tag) => {
    if (!tag.trim()) return;
    const normalized = tag
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 30);
    setParsedData((prev) => ({
      ...prev,
      tags: [...new Set([...(prev?.tags || []), normalized])],
    }));
    setNewTag("");
    setShowTagInput(false);
  };

  // Format datetime with relative labels (Today, Tomorrow, etc.)
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return null;
    const date = new Date(dateTimeStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const targetDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const timeStr = date.toLocaleTimeString(
      language === "en" ? "en-US" : "zh-TW",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: language !== "en",
      },
    );

    // Relative date labels
    if (targetDate.getTime() === today.getTime()) {
      return language === "zh" ? `今天 ${timeStr}` : `Today ${timeStr}`;
    }
    if (targetDate.getTime() === tomorrow.getTime()) {
      return language === "zh" ? `明天 ${timeStr}` : `Tomorrow ${timeStr}`;
    }
    if (targetDate.getTime() === dayAfterTomorrow.getTime()) {
      return language === "zh"
        ? `後天 ${timeStr}`
        : `Day after tomorrow ${timeStr}`;
    }

    // Within a week - show day name
    if (targetDate < nextWeek) {
      const dayName = date.toLocaleDateString(
        language === "en" ? "en-US" : "zh-TW",
        { weekday: "long" },
      );
      return `${dayName} ${timeStr}`;
    }

    // Further out - show full date
    return date.toLocaleString(language === "en" ? "en-US" : "zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative">
      {!isExpanded ? (
        <button
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="w-full flex items-center gap-3 p-3 text-left rounded-lg transition-colors border-2 border-dashed hover:border-primary group"
          style={{
            color: "var(--text-muted)",
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <FaPlus className="w-4 h-4 group-hover:text-primary transition-colors" />
          <span>{placeholder || t.placeholder}</span>
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg shadow-lg p-3 transition-all"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          {/* Input field */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || t.placeholder}
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
            {isParsing && (
              <FaSpinner className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>

          {/* Parsed preview chips */}
          {parsedData && inputText.length >= 3 && (
            <div
              className="flex flex-wrap gap-2 mt-3 pt-3"
              style={{ borderTop: "1px solid var(--card-border)" }}
            >
              {/* DateTime chip */}
              {(parsedData.dateTime || manualDate) && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/30 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={removeDateTime}
                  title={t.removeDate}
                >
                  <FaCalendarAlt className="w-3 h-3" />
                  {formatDateTime(
                    manualDate
                      ? `${manualDate}T${manualTime || "09:00"}`
                      : parsedData.dateTime,
                  )}
                  <FaTimes className="w-2.5 h-2.5 ml-0.5" />
                </span>
              )}

              {/* Priority chip */}
              {parsedData.priority && parsedData.priority !== "medium" && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${PRIORITY[parsedData.priority]?.badgeClass}`}
                  onClick={removePriority}
                  title={t.removePriority}
                >
                  <FaFlag className="w-3 h-3" />
                  {language === "zh"
                    ? PRIORITY[parsedData.priority]?.labelZh
                    : PRIORITY[parsedData.priority]?.label}
                  <FaTimes className="w-2.5 h-2.5 ml-0.5" />
                </span>
              )}

              {/* Duration chip */}
              {parsedData.duration && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
                  <FaClock className="w-3 h-3" />
                  {formatDuration(parsedData.duration)}
                </span>
              )}

              {/* Tag chips */}
              {parsedData.tags?.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getTagClasses(tag)}`}
                  onClick={() => removeTag(tag)}
                  title={t.removeTag}
                >
                  #{tag}
                  <FaTimes className="w-2.5 h-2.5 ml-0.5" />
                </span>
              ))}

              {/* Parsed title preview */}
              {parsedData.title && parsedData.title !== inputText.trim() && (
                <span className="text-xs text-text-muted self-center ml-auto">
                  → {parsedData.title}
                </span>
              )}
            </div>
          )}

          {/* Manual date picker */}
          {showDatePicker && (
            <div
              className="flex items-center gap-2 mt-3 pt-3"
              style={{ borderTop: "1px solid var(--card-border)" }}
            >
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="text-xs px-2 py-1 rounded border bg-transparent"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-primary)",
                }}
              />
              <input
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="text-xs px-2 py-1 rounded border bg-transparent"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="text-xs text-text-muted hover:text-text-secondary"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Manual tag input */}
          {showTagInput && (
            <div
              className="flex items-center gap-2 mt-3 pt-3"
              style={{ borderTop: "1px solid var(--card-border)" }}
            >
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(newTag);
                  }
                }}
                placeholder={t.tagPlaceholder}
                className="flex-1 text-xs px-2 py-1 rounded border bg-transparent"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-primary)",
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => addTag(newTag)}
                className="text-xs px-2 py-1 bg-primary text-text-inverted rounded hover:bg-primary-hover"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setShowTagInput(false)}
                className="text-xs text-text-muted hover:text-text-secondary"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Action bar */}
          <div
            className="flex items-center justify-between mt-3 pt-3"
            style={{ borderTop: "1px solid var(--card-border)" }}
          >
            {/* Left: Quick actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowDatePicker(!showDatePicker);
                  setShowTagInput(false);
                }}
                className={`p-2 rounded transition-colors hover:bg-surface-hover ${showDatePicker ? "text-primary" : ""}`}
                style={{
                  color: showDatePicker ? undefined : "var(--text-muted)",
                }}
                title={t.setDate}
              >
                <FaCalendarAlt className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTagInput(!showTagInput);
                  setShowDatePicker(false);
                }}
                className={`p-2 rounded transition-colors hover:bg-surface-hover ${showTagInput ? "text-primary" : ""}`}
                style={{
                  color: showTagInput ? undefined : "var(--text-muted)",
                }}
                title={t.setTag}
              >
                <FaTag className="w-4 h-4" />
              </button>

              {/* AI Assistant button */}
              {onOpenAI && (
                <button
                  type="button"
                  onClick={handleForwardToAI}
                  className="p-2 rounded transition-colors hover:bg-accent-light text-accent hover:text-accent-hover ml-1"
                  title={t.aiAssist}
                >
                  <FaRobot className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Right: Submit/Cancel */}
            <div className="flex items-center gap-2">
              {/* Parsing indicator with hint */}
              {isParsing && (
                <span
                  className="text-xs text-primary flex items-center gap-1"
                  title={t.parsingHint}
                >
                  <FaSpinner className="w-3 h-3 animate-spin" />
                  {t.parsing}
                </span>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm rounded transition-colors hover:opacity-70"
                style={{ color: "var(--text-secondary)" }}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={!inputText.trim() || isSubmitting}
                className={`px-3 py-1.5 text-sm text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isParsing
                    ? "bg-primary/70 hover:bg-primary"
                    : "bg-primary hover:bg-primary-hover"
                }`}
                title={isParsing ? t.parsingHint : undefined}
              >
                {isSubmitting ? t.adding : t.add}
              </button>
            </div>
          </div>

          {/* Escalation bar for complex requests */}
          {showEscalation && inputText.trim() && (
            <div
              className="flex items-center gap-2 mt-3 pt-3"
              style={{ borderTop: "1px solid var(--card-border)" }}
            >
              <div
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{
                  background: "var(--warning-light)",
                  color: "var(--warning)",
                  border: "1px solid rgba(217, 119, 6, 0.25)",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>
                  {language === "zh"
                    ? "這個請求可能需要 AI 對話來完成"
                    : "This request may need an AI conversation"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleForwardToAI}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors"
                style={{ background: "#7c3aed" }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                  <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                </svg>
                {language === "zh" ? "開啟 AI 對話" : "Open in AI Chat"}
              </button>
            </div>
          )}

          {/* Inline confirmation card */}
          {inlineResult && (
            <div
              className="flex items-center gap-2 mt-3 pt-3"
              style={{ borderTop: "1px solid var(--card-border)" }}
            >
              <div
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{
                  background: "var(--success-light)",
                  border: "1px solid rgba(22, 163, 74, 0.25)",
                  color: "var(--text-primary)",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  {language === "zh" ? "已建立 " : "Created "}
                  <span style={{ fontWeight: 500 }}>{inlineResult.title}</span>
                  {inlineResult.dateTime && (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        marginLeft: "4px",
                      }}
                    >
                      {formatDateTime(inlineResult.dateTime)}
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInlineResult(null);
                  setIsExpanded(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  color: "var(--text-muted)",
                  background: "var(--surface-hover)",
                }}
              >
                {language === "zh" ? "關閉" : "Dismiss"}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
