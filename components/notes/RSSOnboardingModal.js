"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { VALID_CATEGORIES } from "@/lib/rss/defaultFeeds";

export default function RSSOnboardingModal({ open, onClose, onConfirm }) {
  const t = useTranslations("notes");
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setShouldRender(true);
      setIsClosing(false);
      setSelectedCategories(new Set());
    }
  }, [open]);

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
      triggerRef.current?.focus();
    }, 150);
  }, [onClose]);

  const toggleCategory = useCallback((cat) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (selectedCategories.size === 0) return;
    setLoading(true);
    try {
      await onConfirm([...selectedCategories]);
      handleAnimatedClose();
    } catch (err) {
      console.error("RSS subscription error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategories, onConfirm, handleAnimatedClose]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        handleAnimatedClose();
      }
    },
    [handleAnimatedClose],
  );

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
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
        onClick={handleAnimatedClose}
      />

      <div
        className={`relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl ${isClosing ? "modal-panel-exit" : "modal-panel-enter"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <h2
            id={titleId}
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("rssOnboardingTitle")}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("rssOnboardingDescription")}
          </p>
        </div>

        <div className="px-5 py-4 flex flex-wrap gap-2">
          {VALID_CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  isSelected
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-transparent border-[var(--card-border)] hover:border-[var(--accent)]"
                }`}
                style={isSelected ? {} : { color: "var(--text-secondary)" }}
              >
                {t(`rssCategory_${cat}`)}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="secondary" size="sm" onClick={handleAnimatedClose}>
            {t("rssCancel")}
          </Button>
          <Button
            ref={confirmRef}
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={selectedCategories.size === 0 || loading}
          >
            {loading ? t("rssLoadingSubscriptions") : t("rssConfirm")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
