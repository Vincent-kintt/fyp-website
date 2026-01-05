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
      work: "bg-primary-light text-primary",
      personal: "bg-success-light text-success",
      health: "bg-danger-light text-danger",
      other: "bg-background-tertiary text-text-secondary"
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
              <FaEdit className="text-primary hover:text-primary-hover cursor-pointer" />
            </button>
            <button onClick={() => onDelete(currentReminder.id)}>
              <FaTrash className="text-danger hover:text-danger-hover" />
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
            <span className="bg-info-light text-info px-2 py-1 rounded font-medium">
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
