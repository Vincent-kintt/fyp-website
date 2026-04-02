"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { FaClock, FaTag, FaEdit, FaArrowLeft, FaTrash, FaHourglass, FaFlag, FaStickyNote, FaSync, FaPlay, FaCheck, FaPause, FaCheckCircle } from "react-icons/fa";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EditReminderModal from "@/components/reminders/EditReminderModal";
import { getStatusConfig, getTagClasses, formatDuration } from "@/lib/utils";
import { getPriority } from "@/lib/taskConfig";
import { formatDateFull } from "@/lib/format";

export default function ReminderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("reminders");
  const tStatus = useTranslations("status");
  const tPriority = useTranslations("priority");
  const tCommon = useTranslations("common");
  const locale = useLocale();
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
          setError(t("notFound"));
        }
      } catch (err) {
        console.error("Error fetching reminder:", err);
        setError(t("failedToLoad"));
      } finally {
        setLoading(false);
      }
    };

    fetchReminder();
  }, [params.id, t]);

  const handleDelete = async () => {
    if (!confirm(t("confirmDelete"))) {
      return;
    }

    try {
      const response = await fetch(`/api/reminders/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("deleted"));
        router.push("/reminders");
        router.refresh();
      } else {
        toast.error(t("deleteFailed"));
      }
    } catch (err) {
      console.error("Error deleting reminder:", err);
      toast.error(t("deleteFailed"));
    }
  };

  const handleSave = (updatedReminder) => {
    setReminder(updatedReminder);
    toast.success(t("updated"));
  };

  const StatusIcon = {
    pending: FaClock,
    in_progress: FaPlay,
    completed: FaCheck,
    snoozed: FaPause,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p style={{ color: "var(--text-secondary)" }}>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !reminder) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded-lg">
          {error || t("notFound")}
        </div>
      </div>
    );
  }

  const status = reminder.status || "pending";
  const statusConfig = getStatusConfig(status);
  const StatusIconComponent = StatusIcon[status] || FaClock;
  const tags = reminder.tags?.length > 0 ? reminder.tags : [reminder.category || "personal"];
  const priority = reminder.priority || "medium";
  const pConfig = getPriority(priority);

  return (
    <div className="max-w-3xl mx-auto">
      <Button
        variant="outline"
        onClick={() => router.push("/reminders")}
        className="mb-6 flex items-center space-x-2"
      >
        <FaArrowLeft />
        <span>{t("backToReminders")}</span>
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
              {tStatus(status)}
            </span>

            {/* Priority */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${pConfig.badgeClass}`}>
              <FaFlag className="w-3 h-3" />
              {tPriority(priority)}
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
          <span>{formatDateFull(reminder.dateTime, locale)}</span>
        </div>

        {/* Tags */}
        <div className="mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <FaTag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            {tags.map((tag) => (
              <span
                key={tag}
                className={`px-2.5 py-1 rounded text-xs font-medium ${getTagClasses(tag)}`}
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
              {t("description")}
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
            <span>{t("edit")}</span>
          </Button>
          <Button variant="danger" onClick={handleDelete} className="flex items-center space-x-2">
            <FaTrash />
            <span>{t("delete")}</span>
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
