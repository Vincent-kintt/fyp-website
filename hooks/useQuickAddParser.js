"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isComplexRequest } from "@/lib/quickAdd/isComplexRequest.js";

const DEBOUNCE_MS = 600;
const MIN_PARSE_LEN = 3;

/**
 * Pure async parser body — POST the user's text to /api/ai/parse-task and
 * funnel results through injected state writers. Extracted as a top-level
 * function so vitest can test it directly (no React rendering).
 *
 * Matches the executeDragEnd / executeQuickAdd DI pattern.
 *
 * @param {object} args
 * @param {string} args.text
 * @param {"en" | "zh"} args.language
 * @param {typeof fetch} args.fetchFn - DI for fetch (defaults injected by hook)
 * @param {AbortSignal} args.signal - controller signal owned by the caller
 * @param {{
 *   setParsedData: (data: object | null) => void,
 *   setIsParsing: (v: boolean) => void,
 * }} args.writers
 * @returns {Promise<object | null>} the parsed payload, or null on
 *   empty input / failure / abort.
 */
export async function executeParse({
  text,
  language,
  fetchFn,
  signal,
  writers,
}) {
  if (!text || !text.trim() || text.length < MIN_PARSE_LEN) {
    writers.setParsedData(null);
    return null;
  }

  writers.setIsParsing(true);
  try {
    const response = await fetchFn("/api/ai/parse-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      signal,
    });

    if (signal.aborted) return null;
    if (!response.ok) return null;

    const result = await response.json();
    if (signal.aborted) return null;
    if (!result.success) return null;

    writers.setParsedData(result.data);
    return result.data;
  } catch (error) {
    if (error.name === "AbortError") return null;
    console.error("Parse error:", error);
    return null;
  } finally {
    // Only the newest (un-aborted) request owns the spinner state.
    if (!signal.aborted) {
      writers.setIsParsing(false);
    }
  }
}

/**
 * React hook owning the QuickAdd NLP parser:
 *   - debounced fetch to `/api/ai/parse-task`
 *   - AbortController-backed cancellation so stale responses can't overwrite
 *   - escalation-detection short-circuit for "complex" inputs
 *
 * Exposes minimum surface needed by QuickAdd.jsx — parsedData / isParsing /
 * showEscalation read state; handleInputChange + resetParse + cancelInFlight
 * are imperative; setParsedData is exposed for chip-edit handlers (which
 * still live in the component because they touch JSX).
 *
 * @param {{ language: "en" | "zh", fetchFn?: typeof fetch }} options
 */
export function useQuickAddParser({ language, fetchFn = fetch } = {}) {
  const [parsedData, setParsedData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);

  const debounceRef = useRef(null);
  const parseAbortRef = useRef(null);

  const cancelInFlight = useCallback(() => {
    parseAbortRef.current?.abort();
  }, []);

  // Idempotent reset — wipe parser state + cancel any in-flight fetch.
  const resetParse = useCallback(() => {
    cancelInFlight();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setParsedData(null);
    setIsParsing(false);
    setShowEscalation(false);
  }, [cancelInFlight]);

  const handleInputChange = useCallback(
    (text) => {
      if (isComplexRequest(text)) {
        setShowEscalation(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        cancelInFlight();
        setParsedData(null);
        setIsParsing(false);
        return;
      }

      setShowEscalation(false);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        // Each invocation owns its own AbortController so a later
        // keystroke can abort an earlier in-flight parse without
        // touching the newest one.
        cancelInFlight();
        const controller = new AbortController();
        parseAbortRef.current = controller;

        executeParse({
          text,
          language,
          fetchFn,
          signal: controller.signal,
          writers: { setParsedData, setIsParsing },
        });
      }, DEBOUNCE_MS);
    },
    [language, fetchFn, cancelInFlight],
  );

  // Cleanup timers + in-flight fetch on unmount.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      parseAbortRef.current?.abort();
    },
    [],
  );

  return {
    parsedData,
    setParsedData,
    isParsing,
    showEscalation,
    setShowEscalation,
    handleInputChange,
    resetParse,
    cancelInFlight,
  };
}
