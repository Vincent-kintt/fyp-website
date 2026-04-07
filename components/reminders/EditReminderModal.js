"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import { useTranslations } from "next-intl";
import TaskEditForm from "@/components/tasks/TaskEditForm";
import useScrollLock from "@/hooks/useScrollLock";

export default function EditReminderModal({ isOpen, onClose, reminder, onSave }) {
  const t = useTranslations("editForm");
  useScrollLock(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Manage mount/unmount with animation
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

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      handleAnimatedClose();
    }
  }, [handleAnimatedClose]);

  useEffect(() => {
    if (shouldRender) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shouldRender, handleKeyDown]);

  const handleFormSave = (updatedTask) => {
    onSave(updatedTask);
    handleAnimatedClose();
  };

  if (!shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
        onClick={handleAnimatedClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl flex flex-col ${isClosing ? "modal-panel-exit" : "modal-panel-enter"}`}
        style={{ maxHeight: "min(90vh, 800px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("editReminder")}
          </h2>
          <button
            onClick={handleAnimatedClose}
            className="p-2 rounded-lg hover:bg-gray-500/20 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <TaskEditForm
          reminder={reminder}
          isActive={isOpen}
          onSave={handleFormSave}
          onCancel={handleAnimatedClose}
          variant="modal"
        />
      </div>
    </div>,
    document.body
  );
}
