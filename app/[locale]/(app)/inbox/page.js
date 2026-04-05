"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderKeys } from "@/lib/queryKeys";

import useInboxTasks from "@/hooks/useInboxTasks";
import InboxInput from "@/components/inbox/InboxInput";
import InboxTaskRow from "@/components/inbox/InboxTaskRow";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("inbox");
  const queryClient = useQueryClient();
  const { tasks, loading, addTask, refetch } = useInboxTasks();

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Cmd+J → AI modal
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsAIModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = () => setIsAIModalOpen(true);
    window.addEventListener("open-ai-modal", handler);
    return () => window.removeEventListener("open-ai-modal", handler);
  }, []);

  const handleTaskAdded = useCallback(
    async (taskData) => {
      try {
        await addTask(taskData);
      } catch {
        toast.error(t("addFailed"));
      }
    },
    [addTask, t],
  );

  const handleToggleComplete = useCallback(
    async (id, completed) => {
      try {
        await fetch(`/api/reminders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        });
        queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      } catch {
        toast.error(t("addFailed"));
      }
    },
    [queryClient, t],
  );

  const fetchTasks = useCallback(
    ({ silent } = {}) => {
      if (silent) refetch();
    },
    [refetch],
  );

  if (status === "loading" || loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
        <div className="h-8 w-32 rounded animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        <div className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
        {t("title")}
      </h1>
      {tasks.length > 0 && (
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {t("unprocessed", { count: tasks.length })}
        </p>
      )}
      {tasks.length === 0 && !loading && <div className="mb-4" />}

      <InboxInput onTaskAdded={handleTaskAdded} />

      {tasks.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {t("inboxZero")}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {t("inboxZeroDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {tasks.map((task) => (
            <InboxTaskRow
              key={task._id || task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onClick={(id) => setSelectedTaskId(id)}
            />
          ))}
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: reminderKeys.all })}
        />
      )}

      <AIReminderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        fetchTasks={fetchTasks}
      />
    </div>
  );
}
