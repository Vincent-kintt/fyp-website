"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FiPlus, FiX } from "react-icons/fi";

const DEBOUNCE_MS = 800;

function StarIcon({ size = 12 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  );
}

export default function InboxInput({ onTaskAdded }) {
  const t = useTranslations("inbox");
  const locale = useLocale();

  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const [isComposing, setIsComposing] = useState(false);

  const textareaRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const parseText = useCallback(
    async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.length < 3) {
        setParsedResult(null);
        return;
      }
      if (dismissed.has(trimmed)) return;

      const currentId = ++requestIdRef.current;
      setIsParsing(true);

      try {
        const res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: input,
            language: locale === "zh-TW" ? "zh" : "en",
          }),
        });
        const data = await res.json();

        // Reject stale responses
        if (currentId !== requestIdRef.current) return;

        if (
          data.success &&
          data.data?.isTask &&
          data.data?.confidence?.overall >= 0.7
        ) {
          setParsedResult(data.data);
        } else {
          setParsedResult(null);
        }
      } catch {
        if (currentId === requestIdRef.current) {
          setParsedResult(null);
        }
      } finally {
        if (currentId === requestIdRef.current) {
          setIsParsing(false);
        }
      }
    },
    [locale, dismissed]
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    resizeTextarea();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Skip AI parse during IME composition
    if (!isComposing) {
      debounceRef.current = setTimeout(() => parseText(value), DEBOUNCE_MS);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const taskData = parsedResult
      ? { ...parsedResult, rawText: trimmed }
      : { title: trimmed, rawText: trimmed };

    onTaskAdded(taskData);
    setText("");
    setParsedResult(null);
    setFocused(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.blur();
    }
  };

  const handleCancel = () => {
    setText("");
    setParsedResult(null);
    setFocused(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.blur();
    }
  };

  const handleDismissSuggestion = () => {
    setDismissed((prev) => new Set(prev).add(text.trim()));
    setParsedResult(null);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Build suggestion bar display text
  const suggestionParts = [];
  if (parsedResult) {
    if (parsedResult.title) suggestionParts.push(parsedResult.title);
    if (parsedResult.dateTime) {
      const d = new Date(parsedResult.dateTime);
      suggestionParts.push(
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      );
      const hours = d.getHours();
      const mins = d.getMinutes();
      if (hours || mins) {
        suggestionParts.push(
          d.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    }
  }

  const showSuggestion = parsedResult !== null;

  return (
    <div className="mb-3">
      {/* Input container */}
      <div
        className="rounded-xl px-4 py-3 transition-all"
        style={{
          backgroundColor: "var(--card-bg)",
          border: `1px solid ${focused ? "var(--primary)" : "var(--card-border)"}`,
        }}
      >
        <div className="flex items-start gap-2">
          <FiPlus
            size={16}
            className="mt-0.5 flex-shrink-0"
            style={{ color: focused ? "var(--primary)" : "var(--text-muted)" }}
            aria-hidden="true"
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              // Keep focused if clicking within the same container
              if (!e.currentTarget.closest("[data-inbox-input]")?.contains(e.relatedTarget)) {
                if (!text.trim()) setFocused(false);
              }
            }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false);
              // Trigger parse after composition ends
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(
                () => parseText(e.target.value),
                DEBOUNCE_MS
              );
            }}
            placeholder={t("newTodo")}
            rows={1}
            className="w-full bg-transparent text-[14px] outline-none resize-none leading-snug"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        {/* Parsing indicator */}
        {isParsing && (
          <div
            className="mt-1.5 ml-6 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {t("parsing")}
          </div>
        )}

        {/* Action buttons — visible when focused */}
        {focused && (
          <div className="mt-2.5 ml-6 flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={!text.trim()}
              className="px-3 py-1 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{
                backgroundColor: "var(--primary)",
                color: "#fff",
              }}
            >
              {t("newTodo")}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 rounded-lg text-[12px] transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              {/* reuse common cancel key */}
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Inline suggestion bar */}
      {showSuggestion && (
        <div
          className="mt-2 mx-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{
            backgroundColor: "var(--primary-light)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            color: "var(--primary)",
          }}
        >
          <StarIcon size={12} />
          <span className="flex-1 truncate">{suggestionParts.join(" · ")}</span>
          <button
            onClick={handleAdd}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--primary) 15%, transparent)",
            }}
          >
            Add
          </button>
          <button
            onClick={handleDismissSuggestion}
            className="p-0.5 rounded transition-colors hover:opacity-70"
            aria-label="Dismiss"
          >
            <FiX size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
