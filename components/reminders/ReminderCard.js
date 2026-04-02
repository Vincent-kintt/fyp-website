"use client";

import { useState } from "react";
import { FaClock, FaTag, FaEdit, FaTrash, FaStickyNote, FaPlay, FaCheck, FaPause } from "react-icons/fa";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Card from "../ui/Card";
import EditReminderModal from "./EditReminderModal";
import { getTagClasses, getStatusConfig, formatDuration } from "@/lib/utils";
import { getCategoryColor } from "@/lib/taskConfig";
import { formatDateMedium } from "@/lib/format";

export default function ReminderCard({ reminder, onDelete, onUpdate }) {
  const t = useTranslations("reminders");
  const tStatus = useTranslations("status");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentReminder, setCurrentReminder] = useState(reminder);

  const handleSave = (updatedReminder) => {
    setCurrentReminder(updatedReminder);
    if (onUpdate) {
      onUpdate(updatedReminder);
    }
    toast.success(t("updated"));
  };
  // Get tags or fallback to category
  const tags = currentReminder.tags?.length > 0 
    ? currentReminder.tags 
    : [currentReminder.category || "personal"];

  // Get status config
  const status = currentReminder.status || "pending";
  const statusConfig = getStatusConfig(status);
  
  // Status icon mapping
  const StatusIcon = {
    pending: FaClock,
    in_progress: FaPlay,
    completed: FaCheck,
    snoozed: FaPause,
  }[status] || FaClock;

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
          <p className="mb-2" style={{ color: "var(--text-secondary)" }}>{currentReminder.description}</p>
        )}

        {currentReminder.remark && (
          <div className="mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-1.5">
              <FaStickyNote className="w-3 h-3 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">{currentReminder.remark}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          {/* Status Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusConfig.textColor}`}>
              <StatusIcon className="w-3 h-3" />
              {tStatus(status)}
            </span>
            
            {/* Duration Badge */}
            {currentReminder.duration && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <FaClock className="w-2.5 h-2.5" />
                {formatDuration(currentReminder.duration)}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            <FaClock className="flex-shrink-0" />
            <span>{formatDateMedium(currentReminder.dateTime)}</span>
          </div>
          
          {/* Tags Display */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <FaTag className="flex-shrink-0 w-3 h-3" />
            {tags.slice(0, 4).map((tag, idx) => (
              <span 
                key={idx} 
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTagClasses(tag)}`}
              >
                {tag}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="px-1.5 py-0.5 rounded text-xs" style={{ color: "var(--text-muted)" }}>
                +{tags.length - 4}
              </span>
            )}
          </div>
        </div>

        {currentReminder.recurring && (
          <div className="mt-3 text-sm">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
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
