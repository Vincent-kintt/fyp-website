"use client";

// State container + reset useEffect for TaskEditForm. Extracted so the
// reset semantics — reminder change + isActive=true triggers a rebuild,
// isActive=false preserves prior state through the modal close-animation —
// can be characterized in isolation. Logic lives in module-level helpers
// (`buildFormDataFromReminder`, `applyAddTag`, etc.); the hook is a thin
// useState + useEffect wrapper around them, matching the executeDragEnd
// pattern (`hooks/useTaskDnD.js`).

import { useCallback, useEffect, useState } from "react";
import { normalizeTag } from "@/lib/utils";
import { toLocalDateTimeString } from "@/lib/forms/dateTimeLocal";

export const EMPTY_FORM_DATA = Object.freeze({
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
  subtasks: [],
});

// Maps a reminder record (server shape) into the form-state shape consumed
// by <input> / <select> elements. The datetime is pre-formatted as a
// LOCAL wall-clock string — see toLocalDateTimeString — because
// <input type="datetime-local"> rejects ISO-with-Z values.
export function buildFormDataFromReminder(reminder) {
  return {
    title: reminder.title || "",
    description: reminder.description || "",
    remark: reminder.remark || "",
    dateTime: reminder.dateTime
      ? toLocalDateTimeString(new Date(reminder.dateTime))
      : "",
    duration: reminder.duration || null,
    status: reminder.status || "pending",
    category: reminder.category || "personal",
    tags: reminder.tags || [],
    recurring: reminder.recurring || false,
    recurringType: reminder.recurringType || "daily",
    priority: reminder.priority || "medium",
    subtasks: reminder.subtasks || [],
  };
}

// Reset-gate predicate kept separate from useEffect so it's directly
// testable. TaskDetailPanel remounts the form via contentKey when switching
// tasks; EditReminderModal keeps shouldRender true through a 150ms close
// animation and toggles isOpen → isActive=false during that window so the
// fade-out doesn't visibly flash a cleared form.
export function shouldResetFromReminder(reminder, isActive) {
  return Boolean(reminder && isActive);
}

export function applyHandleChange(prev, e) {
  const { name, value, type, checked } = e;
  return {
    ...prev,
    [name]: type === "checkbox" ? checked : value,
  };
}

export function applyAddTag(prev, rawTag) {
  const normalized = normalizeTag(rawTag);
  if (!normalized || normalized.length < 2) return prev;
  if (prev.tags.includes(normalized)) return prev;
  return { ...prev, tags: [...prev.tags, normalized] };
}

export function applyRemoveTag(prev, tagToRemove) {
  return { ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) };
}

export function applyAddSubtask(prev, rawTitle) {
  const trimmed = rawTitle.trim();
  if (!trimmed) return prev;
  const subtask = {
    id: `st-${Date.now()}`,
    title: trimmed,
    completed: false,
  };
  return { ...prev, subtasks: [...prev.subtasks, subtask] };
}

export function applyRemoveSubtask(prev, subtaskId) {
  return {
    ...prev,
    subtasks: prev.subtasks.filter((st) => st.id !== subtaskId),
  };
}

export function useTaskEditFormState({ reminder, isActive }) {
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [error, setError] = useState("");

  // Reset semantics preserved verbatim from pre-refactor TaskEditForm: only
  // rebuild when BOTH a reminder is present AND the form is active. The
  // empty-state branch is intentionally absent — modal close keeps the
  // form populated until the 150ms exit transition finishes and the parent
  // unmounts us.
  useEffect(() => {
    if (!shouldResetFromReminder(reminder, isActive)) return;
    setFormData(buildFormDataFromReminder(reminder));
    setShowSubtasks((reminder.subtasks || []).length > 0);
    setNewTag("");
    setNewSubtask("");
    setError("");
  }, [reminder, isActive]);

  const handleChange = useCallback((e) => {
    setFormData((prev) => applyHandleChange(prev, e.target));
  }, []);

  const addTag = useCallback((rawTag) => {
    setFormData((prev) => applyAddTag(prev, rawTag));
    setNewTag("");
  }, []);

  const removeTag = useCallback((tagToRemove) => {
    setFormData((prev) => applyRemoveTag(prev, tagToRemove));
  }, []);

  const addSubtask = useCallback((rawTitle) => {
    setFormData((prev) => applyAddSubtask(prev, rawTitle));
    setNewSubtask("");
  }, []);

  const removeSubtask = useCallback((subtaskId) => {
    setFormData((prev) => applyRemoveSubtask(prev, subtaskId));
  }, []);

  return {
    formData,
    setFormData,
    newSubtask,
    setNewSubtask,
    newTag,
    setNewTag,
    showSubtasks,
    setShowSubtasks,
    error,
    setError,
    handleChange,
    addTag,
    removeTag,
    addSubtask,
    removeSubtask,
  };
}
