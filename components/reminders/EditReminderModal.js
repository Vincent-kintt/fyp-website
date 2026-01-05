"use client";

import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaClock, FaTag, FaSync, FaFlag, FaPlus, FaTrash } from "react-icons/fa";

export default function EditReminderModal({ isOpen, onClose, reminder, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dateTime: "",
    category: "personal",
    recurring: false,
    recurringType: "daily",
    priority: "medium",
    subtasks: []
  });
  const [newSubtask, setNewSubtask] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (reminder && isOpen) {
      setFormData({
        title: reminder.title || "",
        description: reminder.description || "",
        dateTime: reminder.dateTime 
          ? new Date(reminder.dateTime).toISOString().slice(0, 16) 
          : "",
        category: reminder.category || "personal",
        recurring: reminder.recurring || false,
        recurringType: reminder.recurringType || "daily",
        priority: reminder.priority || "medium",
        subtasks: reminder.subtasks || []
      });
      setNewSubtask("");
      setError("");
    }
  }, [reminder, isOpen]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!formData.dateTime) {
      setError("Date & Time is required");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const response = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        onSave({ ...reminder, ...formData });
        onClose();
      } else {
        setError(data.error || "Failed to update reminder");
      }
    } catch (err) {
      console.error("Error updating reminder:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getCategoryColor = (category) => {
    const colors = {
      work: "border-blue-500 bg-blue-500/10",
      personal: "border-green-500 bg-green-500/10",
      health: "border-red-500 bg-red-500/10",
      other: "border-gray-500 bg-gray-500/10"
    };
    return colors[category] || colors.other;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: "border-red-500 bg-red-500/10 text-red-500",
      medium: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
      low: "border-green-500 bg-green-500/10 text-green-500"
    };
    return colors[priority] || colors.medium;
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    const subtask = {
      id: `st-${Date.now()}`,
      title: newSubtask.trim(),
      completed: false
    };
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, subtask]
    }));
    setNewSubtask("");
  };

  const handleRemoveSubtask = (subtaskId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(st => st.id !== subtaskId)
    }));
  };

  const handleSubtaskKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubtask();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Edit Reminder
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-500/20 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label 
              htmlFor="edit-title" 
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="Reminder title"
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-primary)"
              }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label 
              htmlFor="edit-description" 
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Description
            </label>
            <textarea
              id="edit-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional description"
              rows="2"
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 resize-none"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-primary)"
              }}
            />
          </div>

          {/* Date & Time */}
          <div>
            <label 
              htmlFor="edit-dateTime" 
              className="flex items-center gap-1.5 text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaClock className="w-3 h-3" />
              Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-dateTime"
              name="dateTime"
              type="datetime-local"
              value={formData.dateTime}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-primary)"
              }}
            />
          </div>

          {/* Category */}
          <div>
            <label 
              className="flex items-center gap-1.5 text-sm font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaTag className="w-3 h-3" />
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {["personal", "work", "health", "other"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border-2 transition-all ${
                    formData.category === cat 
                      ? getCategoryColor(cat)
                      : "border-transparent bg-gray-500/10"
                  }`}
                  style={{ color: "var(--text-primary)" }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label 
              className="flex items-center gap-1.5 text-sm font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaFlag className="w-3 h-3" />
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["low", "medium", "high"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: p }))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border-2 transition-all ${
                    formData.priority === p 
                      ? getPriorityColor(p)
                      : "border-transparent bg-gray-500/10"
                  }`}
                  style={{ color: formData.priority === p ? undefined : "var(--text-primary)" }}
                >
                  {p === "high" ? "🔴 High" : p === "medium" ? "🟡 Medium" : "🟢 Low"}
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label 
              className="flex items-center gap-1.5 text-sm font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Subtasks
              {formData.subtasks.length > 0 && (
                <span className="text-xs bg-purple-500/20 text-purple-500 px-1.5 py-0.5 rounded">
                  {formData.subtasks.length}
                </span>
              )}
            </label>
            
            {/* Add Subtask Input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={handleSubtaskKeyDown}
                placeholder="Add a subtask..."
                className="flex-1 px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-purple-500/50 text-sm"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--text-primary)"
                }}
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPlus className="w-3 h-3" />
              </button>
            </div>

            {/* Subtask List */}
            {formData.subtasks.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {formData.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-gray-500/10"
                  >
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(subtask.id)}
                      className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                    >
                      <FaTrash className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recurring */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="recurring"
                checked={formData.recurring}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                <FaSync className="w-3 h-3" />
                Recurring
              </span>
            </label>

            {formData.recurring && (
              <select
                name="recurringType"
                value={formData.recurringType}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--text-primary)"
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border transition-colors hover:bg-gray-500/10"
              style={{
                borderColor: "var(--card-border)",
                color: "var(--text-secondary)"
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
