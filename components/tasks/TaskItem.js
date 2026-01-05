"use client";

import { useState } from "react";
import { FaClock, FaEdit, FaTrash } from "react-icons/fa";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import EditReminderModal from "@/components/reminders/EditReminderModal";

export default function TaskItem({ task, onToggleComplete, onDelete, onUpdate, showDate = true }) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(task);

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
      className={`group flex items-start gap-3 p-4 rounded-xl transition-all duration-200 hover:opacity-90 ${
        currentTask.completed ? "opacity-60" : ""
      } ${isCompleting ? "scale-[0.98]" : ""}`}
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
        borderWidth: "1px",
        borderStyle: "solid",
      }}
    >
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
          
          {/* Category Badge */}
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] capitalize border ${
            currentTask.category === 'work' ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' :
            currentTask.category === 'personal' ? 'bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300' :
            currentTask.category === 'health' ? 'bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300' :
            'bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
          }`}>
            {currentTask.category}
          </span>

          {currentTask.recurring && (
            <span className="ml-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-[10px]">
              {currentTask.recurringType}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
}
