"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

export default function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  message,
  defaultValue = "",
  placeholder = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);
  const cancelRef = useRef(null);
  const submitRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  const isValid = value.trim().length > 0;

  // Capture trigger element + mount with animation + reset value
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setValue(defaultValue);
      setShouldRender(true);
      setIsClosing(false);
    }
  }, [open, defaultValue]);

  // Auto-focus input on mount
  useEffect(() => {
    if (shouldRender && !isClosing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [shouldRender, isClosing]);

  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
      triggerRef.current?.focus();
    }, 150);
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    handleAnimatedClose();
  }, [value, onSubmit, handleAnimatedClose]);

  // Escape key + Enter submit + focus trap
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        handleAnimatedClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = [
          inputRef.current,
          cancelRef.current,
          submitRef.current,
        ].filter(Boolean);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [handleAnimatedClose],
  );

  // Enter key on input submits
  const handleInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && isValid) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [isValid, handleSubmit],
  );

  // Keydown listener + scroll lock
  useEffect(() => {
    if (shouldRender) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [shouldRender, handleKeyDown]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
        onClick={handleAnimatedClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl ${isClosing ? "modal-panel-exit" : "modal-panel-enter"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="px-5 pt-5 pb-2">
          <h2
            id={titleId}
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
        </div>

        {/* Message */}
        {message && (
          <div className="px-5 pb-3">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {message}
            </p>
          </div>
        )}

        {/* Input */}
        <div className="px-5 pb-5">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-secondary)] text-sm outline-none focus:ring-2 focus:ring-primary"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={handleAnimatedClose}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={submitRef}
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            disabled={!isValid}
            onClick={handleSubmit}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
