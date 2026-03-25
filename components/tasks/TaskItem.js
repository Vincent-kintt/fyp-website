"use client";

import { useState, forwardRef } from "react";
import { FaClock, FaEdit, FaTrash, FaFlag, FaChevronDown, FaChevronUp, FaMoon } from "react-icons/fa";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import EditReminderModal from "@/components/reminders/EditReminderModal";
import DragHandle from "@/components/ui/DragHandle";
import SnoozePopover from "./SnoozePopover";

const TaskItem = forwardRef(function TaskItem(
  { task, onToggleComplete, onDelete, onUpdate, onSnooze, showDate = true, dragHandleListeners, dragHandleAttributes, isDragging, style: dragStyle },
  ref
) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(task);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);

  const handleToggle = async () => {
    setIsCompleting(true);
    await onToggleComplete(currentTask.id, !currentTask.completed);
    setCurrentTask(prev => ({ ...prev, completed: !prev.completed }));
    setTimeout(() => setIsCompleting(false), 300);
  };

  const formatTaskDate = (dateTime) => {
    const date = new Date(dateTime);
    if (isToday(date)) {
      return format(date, "'Today at' h:mm a");
    }
    if (isTomorrow(date)) {
      return format(date, "'Tomorrow at' h:mm a");
    }
    return format(date, "MMM d 'at' h:mm a");
  };

  const getCategoryColor = (category) => {
    const colors = {
      work: "bg-blue-500",
      personal: "bg-green-500",
      health: "bg-red-500",
      other: "bg-gray-500"
    };
    return colors[category] || colors.other;
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      high: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", label: "High" },
      medium: { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Med" },
      low: { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30", label: "Low" },
    };
    return configs[priority] || configs.medium;
  };

  const subtasks = currentTask.subtasks || [];
  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const hasSubtasks = subtasks.length > 0;

  const handleSubtaskToggle = async (subtaskId) => {
    const updatedSubtasks = subtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    
    try {
      const response = await fetch(`/api/reminders/${currentTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: updatedSubtasks }),
      });
      
      if (response.ok) {
        const updated = { ...currentTask, subtasks: updatedSubtasks };
        setCurrentTask(updated);
        if (onUpdate) onUpdate(updated);
      }
    } catch (error) {
      console.error("Error updating subtask:", error);
    }
  };

  const isOverdue = !currentTask.completed && isPast(new Date(currentTask.dateTime));

  const handleSave = (updatedTask) => {
    setCurrentTask(updatedTask);
    if (onUpdate) {
      onUpdate(updatedTask);
    }
  };

  const formatTimeOnly = (dateTime) => {
    return format(new Date(dateTime), "h:mm a");
  };

  return (
    <>
    <div
      ref={ref}
      className={`group flex items-start gap-3 p-4 rounded-xl transition-all duration-200 hover:opacity-90 ${
        currentTask.completed ? "opacity-60" : ""
      } ${isCompleting ? "scale-[0.98]" : ""} ${isDragging ? "opacity-50" : ""}`}
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
        borderWidth: "1px",
        borderStyle: "solid",
        ...dragStyle,
      }}
    >
      {/* Drag handle */}
      {dragHandleListeners && (
        <DragHandle listeners={dragHandleListeners} attributes={dragHandleAttributes} />
      )}

      {/* Category indicator */}
      <div className={`w-1 h-full min-h-[40px] rounded-full ${getCategoryColor(currentTask.category)}`} />

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 transition-all duration-200 ${
          currentTask.completed
            ? "bg-green-500 border-green-500"
            : "hover:border-blue-500"
        }`}
        style={{
          borderColor: currentTask.completed ? undefined : "var(--text-muted)",
        }}
      >
        {currentTask.completed && (
          <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3
          className={`text-sm font-medium transition-all duration-200 ${
            currentTask.completed ? "line-through" : ""
          }`}
          style={{
            color: currentTask.completed ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          {currentTask.title}
        </h3>
        {currentTask.description && (
          <p 
            className="text-xs mt-0.5 line-clamp-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {currentTask.description}
          </p>
        )}
        {/* Always show time, with full date info when showDate is true */}
        <div 
          className="flex items-center gap-1 mt-1 text-xs flex-wrap"
          style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }}
        >
          <FaClock className="w-3 h-3" />
          <span>{showDate ? formatTaskDate(currentTask.dateTime) : formatTimeOnly(currentTask.dateTime)}</span>
          
          {/* Priority Badge */}
          {currentTask.priority && currentTask.priority !== "medium" && (
            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 border ${getPriorityConfig(currentTask.priority).bg} ${getPriorityConfig(currentTask.priority).border} ${getPriorityConfig(currentTask.priority).color}`}>
              <FaFlag className="w-2 h-2" />
              {getPriorityConfig(currentTask.priority).label}
            </span>
          )}

          {/* Category Badge */}
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] capitalize border ${
            currentTask.category === 'work' ? 'bg-primary-light border-primary/30 text-primary' :
            currentTask.category === 'personal' ? 'bg-success-light border-success/30 text-success' :
            currentTask.category === 'health' ? 'bg-danger-light border-danger/30 text-danger' :
            'bg-background-tertiary border-border text-text-secondary'
          }`}>
            {currentTask.category}
          </span>

          {/* Subtasks Progress */}
          {hasSubtasks && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsSubtasksExpanded(!isSubtasksExpanded); }}
              className="ml-2 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border bg-purple-500/10 border-purple-500/30 text-purple-500 hover:bg-purple-500/20 transition-colors"
            >
              {completedSubtasks}/{subtasks.length}
              {isSubtasksExpanded ? <FaChevronUp className="w-2 h-2" /> : <FaChevronDown className="w-2 h-2" />}
            </button>
          )}

          {currentTask.recurring && (
            <span className="ml-1 px-1.5 py-0.5 bg-info-light text-info rounded text-[10px]">
              {currentTask.recurringType}
            </span>
          )}
        </div>

        {/* Snoozed indicator */}
        {currentTask.status === "snoozed" && currentTask.snoozedUntil && (
          <div className="flex items-center gap-1 mt-1 text-xs text-purple-500">
            <FaMoon className="w-3 h-3" />
            <span>延後至 {format(new Date(currentTask.snoozedUntil), "M/d HH:mm")}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Snooze: show cancel for snoozed tasks, snooze button for others */}
        {onSnooze && currentTask.status !== "completed" && (
          currentTask.status === "snoozed" ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSnooze(currentTask.id, null); }}
              className="px-1.5 py-0.5 text-[10px] text-purple-500 hover:text-purple-700 hover:bg-purple-500/10 rounded transition-colors"
              title="取消延後"
            >
              取消延後
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsSnoozeOpen(!isSnoozeOpen); }}
                className="p-1.5 hover:text-purple-500 transition-colors"
                style={{ color: "var(--text-muted)" }}
                title="延後提醒"
              >
                <FaMoon className="w-3.5 h-3.5" />
              </button>
              {isSnoozeOpen && (
                <SnoozePopover
                  taskId={currentTask.id}
                  onSnooze={onSnooze}
                  onClose={() => setIsSnoozeOpen(false)}
                />
              )}
            </div>
          )
        )}
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="p-1.5 hover:text-blue-600 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <FaEdit className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(currentTask.id)}
          className="p-1.5 hover:text-red-600 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <FaTrash className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtasks List */}
      {hasSubtasks && isSubtasksExpanded && (
        <div className="col-span-full ml-9 mt-2 space-y-1">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-500/10 transition-colors"
            >
              <button
                onClick={() => handleSubtaskToggle(subtask.id)}
                className={`flex-shrink-0 w-4 h-4 rounded border transition-all duration-200 ${
                  subtask.completed
                    ? "bg-purple-500 border-purple-500"
                    : "hover:border-purple-500"
                }`}
                style={{
                  borderColor: subtask.completed ? undefined : "var(--text-muted)",
                }}
              >
                {subtask.completed && (
                  <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <span
                className={`text-xs transition-all duration-200 ${
                  subtask.completed ? "line-through" : ""
                }`}
                style={{
                  color: subtask.completed ? "var(--text-muted)" : "var(--text-secondary)",
                }}
              >
                {subtask.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Edit Modal */}
    <EditReminderModal
      isOpen={isEditModalOpen}
      onClose={() => setIsEditModalOpen(false)}
      reminder={currentTask}
      onSave={handleSave}
    />
    </>
  );
});

export default TaskItem;
