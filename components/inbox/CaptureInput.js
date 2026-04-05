"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import SuggestionBar from "./SuggestionBar";

const DEBOUNCE_MS = 800;

export default function CaptureInput({ onTaskAdded }) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const debounceRef = useRef(null);

  const parseText = useCallback(
    async (input) => {
      if (!input.trim() || input.trim().length < 3) {
        setParsedResult(null);
        return;
      }
      if (dismissed.has(input.trim())) return;

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
        if (data.success && data.data.confidence?.title >= 0.6) {
          setParsedResult(data.data);
        } else {
          setParsedResult(null);
        }
      } catch {
        setParsedResult(null);
      } finally {
        setIsParsing(false);
      }
    },
    [locale, dismissed]
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parseText(value), DEBOUNCE_MS);
  };

  const handleAdd = () => {
    if (!parsedResult) return;
    onTaskAdded({ ...parsedResult, rawText: text });
    setText("");
    setParsedResult(null);
  };

  const handleDismiss = () => {
    setDismissed((prev) => new Set(prev).add(text.trim()));
    setParsedResult(null);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mb-3">
      <div
        className="rounded-xl px-4 py-3 transition-colors"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <input
          type="text"
          value={text}
          onChange={handleChange}
          placeholder={t("quickCapture")}
          className="w-full bg-transparent text-[14px] outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        {isParsing && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {t("parsing")}
          </div>
        )}
      </div>
      {parsedResult && (
        <SuggestionBar
          result={parsedResult}
          onAdd={handleAdd}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}
