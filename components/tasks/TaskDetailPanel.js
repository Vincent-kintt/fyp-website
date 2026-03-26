"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FaTimes } from "react-icons/fa";
import TaskEditForm from "./TaskEditForm";
import { useClickOutside } from "@/hooks/useClickOutside";
import { toast } from "sonner";

export default function TaskDetailPanel({ taskId, tasks, onClose, onSave }) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [contentKey, setContentKey] = useState(taskId);
  const [isMobile, setIsMobile] = useState(false);
  const prevTaskIdRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Open/close/switch animation lifecycle
  useEffect(() => {
    const prevId = prevTaskIdRef.current;
    prevTaskIdRef.current = taskId;

    if (taskId && !prevId) {
      // Opening: null -> taskId
      setShouldRender(true);
      setIsClosing(false);
      setContentKey(taskId);
    } else if (!taskId && prevId) {
      // Closing: taskId -> null
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    } else if (taskId && prevId && taskId !== prevId) {
      // Switching: taskId A -> taskId B (no close/reopen)
      setContentKey(taskId);
    }
  }, [taskId]);

  // Escape to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (shouldRender) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shouldRender, handleKeyDown]);

  // Mobile: lock body scroll
  useEffect(() => {
    if (shouldRender && isMobile) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (isMobile) document.body.style.overflow = "";
    };
  }, [shouldRender, isMobile]);

  // Click outside to close (desktop only)
  const panelRef = useClickOutside(useCallback(() => {
    if (!isMobile && taskId) onClose();
  }, [isMobile, taskId, onClose]));

  const handleFormSave = useCallback((updatedTask) => {
    onSave(updatedTask);
    toast.success("已儲存");
  }, [onSave]);

  if (!shouldRender) return null;

  const currentTask = tasks.find(t => t.id === taskId) || tasks.find(t => t.id === contentKey);

  if (!currentTask) return null;

  const panelClasses = isMobile
    ? "fixed inset-0 z-40"
    : "fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[400px] xl:w-[480px]";

  const ariaProps = isMobile
    ? { role: "dialog", "aria-modal": true, "aria-labelledby": "panel-title" }
    : { role: "complementary", "aria-label": "Task details" };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-[39] bg-black/40 ${isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`${panelClasses} bg-[var(--card-bg)] border-l border-[var(--card-border)] shadow-2xl flex flex-col ${isClosing ? "panel-exit" : "panel-enter"}`}
        {...ariaProps}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2
            id="panel-title"
            className="text-lg font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            Task Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-500/20 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <div key={contentKey} className={contentKey !== taskId ? "" : "panel-content-enter"} style={{ display: "contents" }}>
          <TaskEditForm
            reminder={currentTask}
            isActive={!!taskId}
            onSave={handleFormSave}
            onCancel={onClose}
            variant="panel"
          />
        </div>
      </div>
    </>
  );
}
