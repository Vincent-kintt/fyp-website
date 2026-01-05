"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaInbox, FaPlus, FaLightbulb } from "react-icons/fa";
import TaskItem from "@/components/tasks/TaskItem";
import QuickAdd from "@/components/tasks/QuickAdd";
import AIReminderModal from "@/components/reminders/AIReminderModal";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/reminders");
      const data = await response.json();
      if (data.success) {
        // Sort by creation date, newest first
        const sorted = data.data.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setTasks(sorted);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTasks();
    }
  }, [session]);

  const handleToggleComplete = async (id, completed) => {
    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (response.ok) {
        setTasks(tasks.map((t) => (t.id === id ? { ...t, completed } : t)));
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setTasks(tasks.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleUpdate = (updatedTask) => {
    setTasks(tasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
  };

  const handleQuickAdd = async (taskData) => {
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  // Separate incomplete and completed tasks
  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <FaInbox className="text-blue-500" />
          Inbox
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Capture your thoughts and tasks quickly
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <QuickAdd onAdd={handleQuickAdd} placeholder="Quick capture..." />
        <button
          onClick={() => setIsAIModalOpen(true)}
          className="flex items-center justify-center gap-2 p-3 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors border-2 border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500"
        >
          <FaLightbulb className="w-4 h-4" />
          <span>AI Assistant</span>
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {incompleteTasks.length > 0 ? (
          incompleteTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <FaInbox className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-muted)" }}>
              Your inbox is empty. Start capturing ideas!
            </p>
          </div>
        )}
      </div>

      {/* Completed Section */}
      {completedTasks.length > 0 && (
        <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--card-border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
            Completed ({completedTasks.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {completedTasks.slice(0, 5).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
            {completedTasks.length > 5 && (
              <p className="text-xs py-2 px-4" style={{ color: "var(--text-muted)" }}>
                +{completedTasks.length - 5} more completed
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Modal */}
      <AIReminderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
