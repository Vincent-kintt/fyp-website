"use client";

import { useState } from "react";
import { FaClock, FaTag, FaEdit, FaTrash } from "react-icons/fa";
import { format } from "date-fns";
import Card from "../ui/Card";
import EditReminderModal from "./EditReminderModal";

export default function ReminderCard({ reminder, onDelete, onUpdate }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentReminder, setCurrentReminder] = useState(reminder);

  const handleSave = (updatedReminder) => {
    setCurrentReminder(updatedReminder);
    if (onUpdate) {
      onUpdate(updatedReminder);
    }
  };
  const formatDateTime = (dateTime) => {
    return format(new Date(dateTime), "MMM dd, yyyy 'at' hh:mm a");
  };

  const getCategoryColor = (category) => {
    const colors = {
      work: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
      personal: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      health: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
      other: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
    };
    return colors[category] || colors.other;
  };

  return (
    <>
      <Card>
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{currentReminder.title}</h3>
          <div className="flex space-x-2">
            <button onClick={() => setIsEditModalOpen(true)}>
              <FaEdit className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer" />
            </button>
            <button onClick={() => onDelete(currentReminder.id)}>
              <FaTrash className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300" />
            </button>
          </div>
        </div>

        {currentReminder.description && (
          <p className="mb-3" style={{ color: "var(--text-secondary)" }}>{currentReminder.description}</p>
        )}

        <div className="flex items-center space-x-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          <div className="flex items-center space-x-1">
            <FaClock />
            <span>{formatDateTime(currentReminder.dateTime)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <FaTag />
            <span className={`px-2 py-1 rounded font-medium ${getCategoryColor(currentReminder.category)}`}>
              {currentReminder.category}
            </span>
          </div>
        </div>

        {currentReminder.recurring && (
          <div className="mt-3 text-sm">
            <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded font-medium">
              Recurring: {currentReminder.recurringType}
            </span>
          </div>
        )}
      </Card>

      <EditReminderModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        reminder={currentReminder}
        onSave={handleSave}
      />
    </>
  );
}
