"use client";

import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaClock, FaTag, FaSync, FaFlag, FaPlus, FaTrash, FaPlay, FaCheck, FaPause } from "react-icons/fa";
import { toast } from "sonner";
import { normalizeTag, getTagClasses, DURATION_PRESETS, REMINDER_STATUSES, getStatusConfig, isValidStatusTransition, calculateEndTime } from "@/lib/utils";

export default function EditReminderModal({ isOpen, onClose, reminder, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
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
  const [showSubtasks, setShowSubtasks] = useState(false);

  useEffect(() => {
    if (reminder && isOpen) {
      const rawDesc = reminder.description || "";
      const rawRemark = reminder.remark || "";
      let mergedDescription = rawDesc;
      if (rawRemark && !rawDesc.includes(rawRemark)) {
        mergedDescription = rawDesc
          ? `${rawDesc}\n\n---\n${rawRemark}`
          : rawRemark;
      }

      setFormData({
        title: reminder.title || "",
        description: mergedDescription,
        dateTime: reminder.dateTime
          ? new Date(reminder.dateTime).toISOString().slice(0, 16)
          : "",
        duration: reminder.duration || null,
        status: reminder.status || "pending",
        category: reminder.category || "personal",
        tags: reminder.tags || [],
        recurring: reminder.recurring || false,
        recurringType: reminder.recurringType || "daily",
        priority: reminder.priority || "medium",
        subtasks: reminder.subtasks || []
      });
      setShowSubtasks((reminder.subtasks || []).length > 0);
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
        body: JSON.stringify({ ...formData, remark: "" }),
      });

      const data = await response.json();

      if (data.success) {
        onSave({ ...reminder, ...formData, remark: "" });
        onClose();
      } else {
        toast.error(data.error || "Failed to update reminder");
      }
    } catch (err) {
      console.error("Error updating reminder:", err);
      toast.error("Failed to update reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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

  const SectionLabel = ({ children }) => (
    <div className="flex items-center gap-2.5 pt-1 pb-0.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
        style={{ color: "var(--text-muted)" }}
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--border, var(--card-border))" }} />
    </div>
  );

  const EndTimePreview = () => {
    if (!formData.dateTime || !formData.duration) return null;
    const start = new Date(formData.dateTime);
    const end = calculateEndTime(start, formData.duration);
    const fmt = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return (
      <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>
        {fmt(start)} → {fmt(end)}
      </span>
    );
  };

  const PriorityDot = ({ level }) => {
    const colors = { high: "bg-red-500", medium: "bg-yellow-500", low: "bg-green-500" };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[level]}`} />;
  };

  const StatusIcon = ({ status, className }) => {
    const icons = { pending: FaClock, in_progress: FaPlay, completed: FaCheck, snoozed: FaPause };
    const Icon = icons[status];
    return Icon ? <Icon className={className} /> : null;
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(155, 155, 155, 0.5) transparent", fontSize: "14px" }}>
          {error && (
            <div className="p-3 text-[13px] bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg">
              {error}
            </div>
          )}

          {/* ── CONTENT ── */}
          <div className="space-y-3">
            <SectionLabel>Content</SectionLabel>
            <input
              id="edit-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="Task name"
              className="w-full px-2 py-2 rounded-lg text-[16px] font-semibold bg-transparent border border-transparent outline-none transition-all focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--card-border)] focus:bg-[var(--input-bg)]"
              style={{ color: "var(--text-primary)" }}
              autoFocus
            />
            <textarea
              id="edit-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add notes..."
              rows="3"
              className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 resize-none text-[14px]"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-primary)"
              }}
            />
          </div>

          {/* ── SCHEDULE ── */}
          <div className="space-y-3">
            <SectionLabel>Schedule</SectionLabel>

            {/* Date & Time */}
            <div>
              <label
                htmlFor="edit-dateTime"
                className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5"
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

            {/* Duration */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  Duration
                </span>
                {formData.duration && (
                  <span className="text-[11px] bg-gray-500/20 px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>
                    {formData.duration} min
                  </span>
                )}
                <EndTimePreview />
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      duration: prev.duration === preset.value ? null : preset.value
                    }))}
                    className={`px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-all ${
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

            {/* Recurring - compact row */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="recurring"
                  checked={formData.recurring}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  <FaSync className="w-3 h-3" />
                  Repeat
                </span>
              </label>
              {formData.recurring && (
                <select
                  name="recurringType"
                  value={formData.recurringType}
                  onChange={handleChange}
                  className="px-2.5 py-1.5 rounded-lg border outline-none text-[13px]"
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
          </div>

          {/* ── DETAILS ── */}
          <div className="space-y-3">
            <SectionLabel>Details</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <span className="text-[12px] font-medium mb-1.5 block" style={{ color: "var(--text-muted)" }}>Status</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {REMINDER_STATUSES.map((s) => {
                    const config = getStatusConfig(s);
                    const isCurrent = formData.status === s;
                    const isValid = isCurrent || isValidStatusTransition(formData.status, s);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!isValid}
                        onClick={() => isValid && setFormData(prev => ({ ...prev, status: s }))}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-medium border-2 transition-all ${
                          isCurrent
                            ? config.color
                            : isValid
                              ? "border-transparent bg-gray-500/10 hover:bg-gray-500/20"
                              : "border-transparent bg-gray-500/5 opacity-40 cursor-not-allowed"
                        }`}
                        style={{ color: isCurrent ? undefined : "var(--text-secondary)" }}
                      >
                        <StatusIcon status={s} className="w-3 h-3" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <span className="text-[12px] font-medium mb-1.5 block" style={{ color: "var(--text-muted)" }}>Priority</span>
                <div className="flex flex-col gap-1.5">
                  {["high", "medium", "low"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: p }))}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium capitalize border-2 transition-all ${
                        formData.priority === p
                          ? getPriorityColor(p)
                          : "border-transparent bg-gray-500/10 hover:bg-gray-500/20"
                      }`}
                      style={{ color: formData.priority === p ? undefined : "var(--text-primary)" }}
                    >
                      <PriorityDot level={p} />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── TAGS ── */}
          <div className="space-y-2">
            <SectionLabel>
              Tags
            </SectionLabel>

            {/* Quick Category Tags */}
            <div className="flex flex-wrap gap-2">
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
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
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
            <div className="flex gap-2">
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

          {/* ── SUBTASKS (progressive disclosure) ── */}
          {showSubtasks ? (
            <div className="space-y-2">
              <SectionLabel>
                Subtasks{formData.subtasks.length > 0 ? ` (${formData.subtasks.length})` : ""}
              </SectionLabel>

              {/* Add Subtask Input */}
              <div className="flex gap-2">
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
          ) : (
            <button
              type="button"
              onClick={() => setShowSubtasks(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed text-[13px] font-medium transition-colors hover:bg-gray-500/5"
              style={{
                borderColor: "var(--border, var(--card-border))",
                color: "var(--text-muted)"
              }}
            >
              <FaPlus className="w-3 h-3" />
              Add subtasks
            </button>
          )}

          {/* Spacer for fixed footer */}
          <div className="h-2" />
        </form>

        {/* Fixed Footer */}
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
