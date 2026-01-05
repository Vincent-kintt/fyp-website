"use client";

import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaClock, FaTag, FaSync, FaFlag, FaPlus, FaTrash, FaStickyNote, FaHourglass, FaPlay, FaCheck, FaPause } from "react-icons/fa";
import { normalizeTag, getTagClasses, DURATION_PRESETS, REMINDER_STATUSES, getStatusConfig } from "@/lib/utils";

export default function EditReminderModal({ isOpen, onClose, reminder, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    remark: "",
    dateTime: "",
    duration: null,
    status: "pending",
    category: "personal",
    tags: [],
    recurring: false,
    recurringType: "daily",
    priority: "medium",
    subtasks: []
  });
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");
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
        duration: reminder.duration || null,
        status: reminder.status || "pending",
        category: reminder.category || "personal",
        tags: reminder.tags || [],
        remark: reminder.remark || "",
        recurring: reminder.recurring || false,
        recurringType: reminder.recurringType || "daily",
        priority: reminder.priority || "medium",
        subtasks: reminder.subtasks || []
      });
      setNewTag("");
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

  const handleAddTag = () => {
    const normalized = normalizeTag(newTag);
    if (!normalized || normalized.length < 2) return;
    if (formData.tags.includes(normalized)) {
      setNewTag("");
      return;
    }
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, normalized]
    }));
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal - Flexbox layout for fixed header/footer with scrollable body */}
      <div 
        className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        style={{ maxHeight: "min(90vh, 800px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--card-border)]">
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

        {/* Scrollable Form Body - Typography: labels 14px, inputs 14px, buttons 13px, badges 12px */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(155, 155, 155, 0.5) transparent", fontSize: "14px" }}>
          {error && (
            <div className="p-3 text-[13px] bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label 
              htmlFor="edit-title" 
              className="block text-[13px] font-medium mb-2"
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
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 text-[14px]"
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
              className="block text-[13px] font-medium mb-2"
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
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 resize-none text-[14px]"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-primary)"
              }}
            />
          </div>

          {/* Remark */}
          <div>
            <label 
              htmlFor="edit-remark" 
              className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaStickyNote className="w-3.5 h-3.5" />
              Remark
            </label>
            <textarea
              id="edit-remark"
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              placeholder="Additional notes or info..."
              rows="2"
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-yellow-500/50 resize-none text-[14px]"
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
              className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaClock className="w-3.5 h-3.5" />
              Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-dateTime"
              name="dateTime"
              type="datetime-local"
              value={formData.dateTime}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 text-[14px]"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-primary)"
              }}
            />
          </div>

          {/* Duration (Time Blocking) */}
          <div>
            <label 
              className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaHourglass className="w-3.5 h-3.5" />
              Duration
              {formData.duration && (
                <span className="text-[11px] bg-gray-500/20 px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>
                  {formData.duration} min
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    duration: prev.duration === preset.value ? null : preset.value 
                  }))}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                    formData.duration === preset.value
                      ? "border-blue-500 bg-blue-500/20 text-blue-500"
                      : "border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20"
                  }`}
                  style={{ color: formData.duration === preset.value ? undefined : "var(--text-secondary)" }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label 
              className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REMINDER_STATUSES.map((s) => {
                const config = getStatusConfig(s);
                const StatusIcon = {
                  pending: FaClock,
                  in_progress: FaPlay,
                  completed: FaCheck,
                  snoozed: FaPause,
                }[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border-2 transition-all ${
                      formData.status === s
                        ? config.color
                        : "border-transparent bg-gray-500/10"
                    }`}
                    style={{ color: formData.status === s ? undefined : "var(--text-secondary)" }}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label 
              className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaTag className="w-3.5 h-3.5" />
              Tags
              {formData.tags.length > 0 && (
                <span className="text-[11px] bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded">
                  {formData.tags.length}
                </span>
              )}
            </label>
            
            {/* Quick Category Tags */}
            <div className="flex flex-wrap gap-2 mb-2">
              {["personal", "work", "health", "urgent"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (formData.tags.includes(tag)) {
                      handleRemoveTag(tag);
                    } else {
                      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                    formData.tags.includes(tag)
                      ? getTagClasses(tag)
                      : "border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20"
                  }`}
                  style={{ color: formData.tags.includes(tag) ? undefined : "var(--text-secondary)" }}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add custom tag..."
                className="flex-1 px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 text-[13px]"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--text-primary)"
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!newTag.trim() || newTag.length < 2}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Current Tags Display */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${getTagClasses(tag)}`}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                    >
                      <FaTimes className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label 
              className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <FaFlag className="w-3.5 h-3.5" />
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["low", "medium", "high"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: p }))}
                  className={`px-3 py-2 rounded-lg text-[12px] font-medium capitalize border-2 transition-all ${
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
              className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Subtasks
              {formData.subtasks.length > 0 && (
                <span className="text-[11px] bg-purple-500/20 text-purple-500 px-1.5 py-0.5 rounded">
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
                className="flex-1 px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-purple-500/50 text-[13px]"
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
                <FaPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Subtask List */}
            {formData.subtasks.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {formData.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-500/10"
                  >
                    <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(subtask.id)}
                      className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                    >
                      <FaTrash className="w-3 h-3" />
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
              <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                <FaSync className="w-3.5 h-3.5" />
                Recurring
              </span>
            </label>

            {formData.recurring && (
              <select
                name="recurringType"
                value={formData.recurringType}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 text-[14px]"
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

          {/* Spacer for fixed footer */}
          <div className="h-2" />
        </form>

        {/* Fixed Footer - Action Buttons */}
        <div className="flex-shrink-0 flex gap-3 p-4 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border transition-colors hover:bg-gray-500/10 text-[14px] font-medium"
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
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
