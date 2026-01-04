"use client";

import { useState } from "react";
import { FaPlus, FaCalendarAlt, FaTag } from "react-icons/fa";

export default function QuickAdd({ onAdd, placeholder = "Add a task..." }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd({
        title: title.trim(),
        dateTime: new Date().toISOString(),
        category: "personal",
      });
      setTitle("");
      setIsExpanded(false);
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSubmit(e);
    }
    if (e.key === "Escape") {
      setIsExpanded(false);
      setTitle("");
    }
  };

  return (
    <div className="relative">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center gap-3 p-3 text-left rounded-lg transition-colors border-2 border-dashed hover:border-blue-400"
          style={{
            color: "var(--text-muted)",
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <FaPlus className="w-4 h-4" />
          <span>{placeholder}</span>
        </button>
      ) : (
        <form 
          onSubmit={handleSubmit} 
          className="rounded-lg shadow-lg p-3"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
            className="w-full bg-transparent border-none outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
          <div 
            className="flex items-center justify-between mt-3 pt-3"
            style={{ borderTop: "1px solid var(--card-border)" }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 rounded transition-colors hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                title="Set date"
              >
                <FaCalendarAlt className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded transition-colors hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                title="Set category"
              >
                <FaTag className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  setTitle("");
                }}
                className="px-3 py-1.5 text-sm rounded transition-colors hover:opacity-70"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isSubmitting}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
