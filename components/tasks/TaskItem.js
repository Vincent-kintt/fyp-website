"use client";

import { useState, useEffect, useRef, forwardRef, memo } from "react";
import { FaClock, FaEdit, FaTrash, FaChevronDown, FaChevronUp, FaMoon } from "react-icons/fa";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import EditReminderModal from "@/components/reminders/EditReminderModal";
import DragHandle from "@/components/ui/DragHandle";
import SnoozePopover from "./SnoozePopover";
import { getPriorityConfig, getCategoryIndicatorColor } from "@/lib/utils";

const TaskItem = memo(forwardRef(function TaskItem(
  { task, onToggleComplete, onDelete, onUpdate, onEdit, onSnooze, showDate = true, dragHandleListeners, dragHandleAttributes, isDragging, style: dragStyle, animationClass, animationDelay },
  ref
) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(task);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const snoozeButtonRef = useRef(null);

  // Sync local state when parent updates the task (e.g. from side panel save)
  useEffect(() => {
    setCurrentTask(task);
  }, [task]);

  const handleToggle = () => {
    const newCompleted = !currentTask.completed;
    setCurrentTask(prev => ({ ...prev, completed: newCompleted }));
    onToggleComplete(currentTask.id, newCompleted);
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
      className={`group flex items-start gap-3 p-4 rounded-xl transition-opacity duration-200 hover:opacity-90 ${
        currentTask.completed ? "opacity-60" : ""
      } ${isDragging ? "opacity-50" : ""} ${animationClass || ""}`}
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
        borderWidth: "1px",
        borderStyle: "solid",
        animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
        ...dragStyle,
      }}
    >
      {/* Drag handle */}
      {dragHandleListeners && (
        <DragHandle listeners={dragHandleListeners} attributes={dragHandleAttributes} />
      )}

      {/* Category indicator */}
      <div className={`w-1 h-full min-h-[40px] rounded-full ${getCategoryIndicatorColor(currentTask.category)}`} />

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-[border-color,background-color] duration-200 ${
          currentTask.completed
            ? "bg-success border-success"
            : "hover:border-primary"
        }`}
        style={{
          borderColor: currentTask.completed ? undefined : "var(--text-muted)",
        }}
      >
        {currentTask.completed && (
          <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline
              points="20 6 9 17 4 12"
              strokeDasharray="24"
              strokeDashoffset="0"
              style={{ animation: "checkmark-draw 200ms var(--ease-decelerate)" }}
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3
          className={`text-sm font-medium transition-colors duration-200 ${
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
          style={{ color: isOverdue ? "var(--danger)" : "var(--text-muted)" }}
        >
          <FaClock className="w-3 h-3" />
          <span>{showDate ? formatTaskDate(currentTask.dateTime) : formatTimeOnly(currentTask.dateTime)}</span>
          
          {/* Priority Badge */}
          {currentTask.priority && currentTask.priority !== "medium" && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              <span className={`w-1.5 h-1.5 rounded-full ${getPriorityConfig(currentTask.priority).dotColor}`} />
              {getPriorityConfig(currentTask.priority).label}
            </span>
          )}

          {/* Category Badge */}
          <span className="ml-2 text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>
            {currentTask.category}
          </span>

          {/* Subtasks Progress */}
          {hasSubtasks && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsSubtasksExpanded(!isSubtasksExpanded); }}
              className="ml-2 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 hover:bg-[var(--background-tertiary)] transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              {completedSubtasks}/{subtasks.length}
              {isSubtasksExpanded ? <FaChevronUp className="w-2 h-2" /> : <FaChevronDown className="w-2 h-2" />}
            </button>
          )}

          {currentTask.recurring && (
            <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              {currentTask.recurringType}
            </span>
          )}
        </div>

        {/* Snoozed indicator */}
        {currentTask.status === "snoozed" && currentTask.snoozedUntil && (
          <div className="flex items-center gap-1 mt-1 text-xs text-accent">
            <FaMoon className="w-3 h-3" />
            <span>延後至 {format(new Date(currentTask.snoozedUntil), "M/d HH:mm")}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {/* Snooze: show cancel for snoozed tasks, snooze button for others */}
        {onSnooze && currentTask.status !== "completed" && (
          currentTask.status === "snoozed" ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSnooze(currentTask.id, null); }}
              className="px-1.5 py-0.5 text-[10px] text-accent hover:text-accent-hover hover:bg-accent/10 rounded transition-colors"
              title="取消延後"
            >
              取消延後
            </button>
          ) : (
            <>
              <button
                ref={snoozeButtonRef}
                onClick={(e) => { e.stopPropagation(); setIsSnoozeOpen(!isSnoozeOpen); }}
                className="p-2.5 hover:text-accent transition-colors"
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
                  anchorRef={snoozeButtonRef}
                />
              )}
            </>
          )
        )}
        <button
          onClick={() => onEdit ? onEdit(currentTask.id) : setIsEditModalOpen(true)}
          className="p-2.5 hover:text-primary transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <FaEdit className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(currentTask.id)}
          className="p-2.5 hover:text-danger transition-colors"
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
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <button
                onClick={() => handleSubtaskToggle(subtask.id)}
                className={`flex-shrink-0 w-5 h-5 rounded border transition-[border-color,background-color] duration-200 ${
                  subtask.completed
                    ? "bg-accent border-accent"
                    : "hover:border-accent"
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
                className={`text-xs transition-colors duration-200 ${
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

    {/* Edit Modal — only when side panel is not handling edits */}
    {!onEdit && (
      <EditReminderModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        reminder={currentTask}
        onSave={handleSave}
      />
    )}
    </>
  );
}));

export default TaskItem;
