// hooks/useInlineTaskDetection.js
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLocale } from "next-intl";

const DEBOUNCE_MS = 1200;
const MIN_TEXT_LENGTH = 5;
const CONFIDENCE_THRESHOLD = 0.7;

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function extractParagraphText(block) {
  if (!block?.content || !Array.isArray(block.content)) return "";
  return block.content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("");
}

export default function useInlineTaskDetection(editor) {
  const locale = useLocale();
  const [suggestion, setSuggestion] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const prevBlocksRef = useRef(null);
  const dismissedRef = useRef(new Set());
  const highlightedRef = useRef(null);
  const composingRef = useRef(false);

  // Track IME composition — retry attach if editor DOM not ready
  useEffect(() => {
    let timeoutId;
    let cleanup;
    const attach = () => {
      const dom = editor?.domElement;
      if (!dom) {
        timeoutId = setTimeout(attach, 100);
        return;
      }
      const onStart = () => {
        composingRef.current = true;
        setIsComposing(true);
      };
      const onEnd = () => {
        composingRef.current = false;
        setIsComposing(false);
      };
      dom.addEventListener("compositionstart", onStart);
      dom.addEventListener("compositionend", onEnd);
      cleanup = () => {
        dom.removeEventListener("compositionstart", onStart);
        dom.removeEventListener("compositionend", onEnd);
      };
    };
    attach();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (cleanup) cleanup();
    };
  }, [editor]);

  // Clear highlight from DOM
  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      const el = document.querySelector(
        `[data-id="${highlightedRef.current}"]`
      );
      if (el) el.classList.remove("ai-task-highlight");
      highlightedRef.current = null;
    }
  }, []);

  // Apply highlight to DOM
  const applyHighlight = useCallback(
    (blockId) => {
      clearHighlight();
      const el = document.querySelector(`[data-id="${blockId}"]`);
      if (el) {
        el.classList.add("ai-task-highlight");
        highlightedRef.current = blockId;
      }
    },
    [clearHighlight]
  );

  // Detect changed paragraph
  const detectChangedParagraph = useCallback(() => {
    const currentBlocks = editor.document;
    const prevBlocks = prevBlocksRef.current;

    if (!prevBlocks) {
      prevBlocksRef.current = currentBlocks.map((b) => ({
        id: b.id,
        text: extractParagraphText(b),
      }));
      return null;
    }

    let changedBlock = null;
    for (const block of currentBlocks) {
      const prev = prevBlocks.find((p) => p.id === block.id);
      const currentText = extractParagraphText(block);
      if (!prev || prev.text !== currentText) {
        changedBlock = { id: block.id, text: currentText };
        break;
      }
    }

    prevBlocksRef.current = currentBlocks.map((b) => ({
      id: b.id,
      text: extractParagraphText(b),
    }));

    return changedBlock;
  }, [editor]);

  // Parse text with API
  const parseText = useCallback(
    async (text, blockId, reqId) => {
      setIsParsing(true);
      try {
        const res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            language: locale === "zh-TW" ? "zh" : "en",
          }),
        });
        const data = await res.json();

        // Stale response check
        if (reqId !== requestIdRef.current) return;

        if (
          data.success &&
          data.data.isTask !== false &&
          (data.data.confidence?.overall || 0) >= CONFIDENCE_THRESHOLD
        ) {
          applyHighlight(blockId);
          setSuggestion({
            result: data.data,
            paragraphId: blockId,
            matchedText: data.data.matchedText || text,
          });
        } else {
          clearHighlight();
          setSuggestion(null);
        }
      } catch {
        clearHighlight();
        setSuggestion(null);
      } finally {
        setIsParsing(false);
      }
    },
    [locale, applyHighlight, clearHighlight]
  );

  // Main onChange handler — call this from InboxEditor's onChange
  const handleEditorChange = useCallback(() => {
    // Clear previous suggestion on any edit
    clearHighlight();
    setSuggestion(null);

    // Invalidate any in-flight request immediately on every edit
    ++requestIdRef.current;

    if (composingRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const changed = detectChangedParagraph();
      if (!changed) return;
      if (changed.text.length < MIN_TEXT_LENGTH) return;

      const hash = hashString(changed.text);
      if (dismissedRef.current.has(hash)) return;

      const reqId = ++requestIdRef.current;
      parseText(changed.text, changed.id, reqId);
    }, DEBOUNCE_MS);
  }, [detectChangedParagraph, parseText, clearHighlight]);

  // Add task action — also hash-dismiss to prevent re-detection of same text
  const addTask = useCallback(() => {
    if (suggestion) {
      const block = editor.document.find(
        (b) => b.id === suggestion.paragraphId
      );
      const text = block ? extractParagraphText(block) : "";
      if (text) dismissedRef.current.add(hashString(text));
    }
    clearHighlight();
    const result = suggestion;
    setSuggestion(null);
    return result?.result || null;
  }, [suggestion, editor, clearHighlight]);

  // Dismiss action
  const dismissSuggestion = useCallback(() => {
    if (suggestion) {
      const block = editor.document.find(
        (b) => b.id === suggestion.paragraphId
      );
      const text = block ? extractParagraphText(block) : "";
      if (text) dismissedRef.current.add(hashString(text));
    }
    clearHighlight();
    setSuggestion(null);
  }, [suggestion, editor, clearHighlight]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearHighlight();
    };
  }, [clearHighlight]);

  return {
    suggestion,
    isParsing,
    addTask,
    dismissSuggestion,
    handleEditorChange,
  };
}
