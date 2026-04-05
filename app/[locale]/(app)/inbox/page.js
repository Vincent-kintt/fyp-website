"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTasks } from "@/hooks/useTasks";
import CaptureInput from "@/components/inbox/CaptureInput";
import RecentFeed from "@/components/inbox/RecentFeed";
import AIReminderModal from "@/components/reminders/AIReminderModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("inbox");
  const queryClient = useQueryClient();

  const { tasks, loading, toggleComplete, deleteTask, quickAdd, refetch } =
    useTasks();

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

  // Listen for open-ai-modal from GlobalSearch
  useEffect(() => {
    const handler = () => setIsAIModalOpen(true);
    window.addEventListener("open-ai-modal", handler);
    return () => window.removeEventListener("open-ai-modal", handler);
  }, []);

  const handleTaskDetected = useCallback(
    async (parsed) => {
      try {
        await quickAdd({
          title: parsed.title,
          tags: parsed.tags || [],
          priority: parsed.priority || "medium",
          dateTime: parsed.dateTime || null,
        });
      } catch {
        toast.error(t("addFailed"));
      }
    },
    [quickAdd, t]
  );

  const fetchTasks = useCallback(
    ({ silent } = {}) => {
      if (!silent) return;
      refetch();
    },
    [refetch]
  );

  if (status === "loading" || loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
        <div
          className="h-8 w-32 rounded animate-pulse"
          style={{ backgroundColor: "var(--surface-hover)" }}
        />
        <div
          className="h-14 rounded-xl animate-pulse"
          style={{ backgroundColor: "var(--surface-hover)" }}
        />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg animate-pulse"
            style={{ backgroundColor: "var(--surface-hover)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {t("title")}
      </h1>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        {t("subtitle")}
      </p>

      <CaptureInput onTaskAdded={handleTaskDetected} />

      <RecentFeed
        tasks={tasks}
        onToggleComplete={toggleComplete}
        onDelete={deleteTask}
        onEdit={(id) => setSelectedTaskId(id)}
      />

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
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
