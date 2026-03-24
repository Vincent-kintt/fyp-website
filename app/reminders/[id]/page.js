"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaClock, FaTag, FaEdit, FaArrowLeft, FaTrash, FaHourglass, FaFlag, FaStickyNote, FaSync, FaPlay, FaCheck, FaPause, FaCheckCircle } from "react-icons/fa";
import { format } from "date-fns";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EditReminderModal from "@/components/reminders/EditReminderModal";
import { getStatusConfig, getTagClasses, formatDuration } from "@/lib/utils";

export default function ReminderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchReminder = async () => {
      try {
        const response = await fetch(`/api/reminders/${params.id}`);
        const data = await response.json();

        if (data.success) {
          setReminder(data.data);
        } else {
          setError("Reminder not found");
        }
      } catch (err) {
        console.error("Error fetching reminder:", err);
        setError("Failed to load reminder");
      } finally {
        setLoading(false);
      }
    };

    fetchReminder();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this reminder?")) {
      return;
    }

    try {
      const response = await fetch(`/api/reminders/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Reminder deleted");
        router.push("/reminders");
        router.refresh();
      } else {
        toast.error("Failed to delete reminder");
      }
    } catch (err) {
      console.error("Error deleting reminder:", err);
      toast.error("Failed to delete reminder");
    }
  };

  const handleSave = (updatedReminder) => {
    setReminder(updatedReminder);
    toast.success("Reminder updated");
  };

  const formatDateTime = (dateTime) => {
    return format(new Date(dateTime), "MMMM dd, yyyy 'at' hh:mm a");
  };

  const StatusIcon = {
    pending: FaClock,
    in_progress: FaPlay,
    completed: FaCheck,
    snoozed: FaPause,
  };

  const priorityConfig = {
    high: { label: "High", color: "bg-red-500/10 text-red-500 border-red-500/30" },
    medium: { label: "Medium", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
    low: { label: "Low", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p style={{ color: "var(--text-secondary)" }}>Loading reminder...</p>
        </div>
      </div>
    );
  }

  if (error || !reminder) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded-lg">
          {error || "Reminder not found"}
        </div>
      </div>
    );
  }

  const status = reminder.status || "pending";
  const statusConfig = getStatusConfig(status);
  const StatusIconComponent = StatusIcon[status] || FaClock;
  const tags = reminder.tags?.length > 0 ? reminder.tags : [reminder.category || "personal"];
  const priority = reminder.priority || "medium";
  const pConfig = priorityConfig[priority] || priorityConfig.medium;

  return (
    <div className="max-w-3xl mx-auto">
      <Button
        variant="outline"
        onClick={() => router.push("/reminders")}
        className="mb-6 flex items-center space-x-2"
      >
        <FaArrowLeft />
        <span>Back to Reminders</span>
      </Button>

      <Card>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            {reminder.title}
          </h1>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
              <StatusIconComponent className="w-3 h-3" />
              {statusConfig.label}
            </span>

            {/* Priority */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${pConfig.color}`}>
              <FaFlag className="w-3 h-3" />
              {pConfig.label}
            </span>

            {/* Duration */}
            {reminder.duration && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--background-secondary)" }}>
                <FaHourglass className="w-3 h-3" />
                {formatDuration(reminder.duration)}
              </span>
            )}

            {/* Recurring */}
            {reminder.recurring && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-info-light text-info border border-info/30">
                <FaSync className="w-3 h-3" />
                {reminder.recurringType}
              </span>
            )}
          </div>
        </div>

        {/* Date & Time */}
        <div className="mb-5 flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <FaClock className="w-4 h-4 flex-shrink-0" />
          <span>{formatDateTime(reminder.dateTime)}</span>
        </div>

        {/* Tags */}
        <div className="mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <FaTag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            {tags.map((tag) => (
              <span
                key={tag}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getTagClasses(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Description */}
        {reminder.description && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Description
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {reminder.description}
            </p>
          </div>
        )}

        {/* Remark */}
        {reminder.remark && (
          <div className="mb-5">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-start gap-2">
                <FaStickyNote className="w-3.5 h-3.5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{reminder.remark}</p>
              </div>
            </div>
          </div>
        )}

        {/* Subtasks */}
        {reminder.subtasks?.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Subtasks ({reminder.subtasks.filter(s => s.completed).length}/{reminder.subtasks.length})
            </h2>
            <div className="space-y-1.5">
              {reminder.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg"
                  style={{ backgroundColor: "var(--background-secondary)" }}
                >
                  {subtask.completed ? (
                    <FaCheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: "var(--border)" }} />
                  )}
                  <span
                    className={`text-sm ${subtask.completed ? "line-through" : ""}`}
                    style={{ color: subtask.completed ? "var(--text-muted)" : "var(--text-primary)" }}
                  >
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <Button
            variant="primary"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <FaEdit />
            <span>Edit</span>
          </Button>
          <Button variant="danger" onClick={handleDelete} className="flex items-center space-x-2">
            <FaTrash />
            <span>Delete</span>
          </Button>
        </div>
      </Card>

      <EditReminderModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        reminder={reminder}
        onSave={handleSave}
      />
    </div>
  );
}
