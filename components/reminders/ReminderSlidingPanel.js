"use client";

import { useState, useEffect, useRef } from "react";
import { FaTimes } from "react-icons/fa";
import AIReminderInput from "./AIReminderInput";

export default function ReminderSlidingPanel({ isOpen, onClose, onSuccess }) {
  const [error, setError] = useState("");
  const [panelWidth, setPanelWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when panel is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Reset error when panel closes
  useEffect(() => {
    if (!isOpen) {
      setError("");
    }
  }, [isOpen]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      // Set min width to 320px and max width to 80% of screen
      const minWidth = 320;
      const maxWidth = window.innerWidth * 0.8;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleAIGenerate = async (reminderData) => {
    try {
      setError("");

      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reminderData),
      });

      const data = await response.json();

      if (data.success) {
        // Success - close panel and notify parent
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(data.error || "Failed to create reminder");
      }
    } catch (error) {
      console.error("Error creating reminder:", error);
      setError("An error occurred. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sliding Panel */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 bg-surface shadow-2xl z-50 overflow-y-auto"
        style={{
          width: window.innerWidth < 640 ? '100%' : `${panelWidth}px`,
          transition: isResizing ? 'none' : 'transform 0.3s ease-in-out'
        }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary transition-colors group"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-border group-hover:bg-primary transition-colors rounded-r" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-text-primary">
            Create New Reminder
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
            aria-label="Close panel"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-text-secondary mb-6">
            Describe your reminder in natural language and let AI handle the rest!
          </p>

          {error && (
            <div className="mb-4 bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* AI Input Section */}
          <AIReminderInput onGenerate={handleAIGenerate} />
        </div>
      </div>
    </>
  );
}
