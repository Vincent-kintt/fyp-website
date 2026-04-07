"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  // Capture trigger element + mount with animation
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setShouldRender(true);
      setIsClosing(false);
    }
  }, [open]);

  // Auto-focus confirm button on mount
  useEffect(() => {
    if (shouldRender && !isClosing) {
      confirmRef.current?.focus();
    }
  }, [shouldRender, isClosing]);

  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
      // Restore focus to trigger element
      triggerRef.current?.focus();
    }, 150);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    handleAnimatedClose();
  }, [onConfirm, handleAnimatedClose]);

  // Escape key + focus trap
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        handleAnimatedClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = [cancelRef.current, confirmRef.current].filter(
          Boolean,
        );
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
        <div className="px-5 pb-5">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {message}
          </p>
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
            ref={confirmRef}
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
