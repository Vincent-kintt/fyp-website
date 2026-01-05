"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSun, FaCalendarDay, FaCalendarWeek, FaCheckCircle } from "react-icons/fa";
import { isToday, isTomorrow, isThisWeek, startOfDay, endOfDay, addDays } from "date-fns";
import TaskSection from "@/components/tasks/TaskSection";
import QuickAdd from "@/components/tasks/QuickAdd";
import NextTaskCard from "@/components/dashboard/NextTaskCard";
import StatsOverview from "@/components/dashboard/StatsOverview";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import AIReminderModal from "@/components/reminders/AIReminderModal";

export default function DashboardPage() {
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
        setTasks(data.data);
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

  const now = new Date();
  
  // Sort tasks by dateTime
  const sortedTasks = [...tasks].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const todayTasks = sortedTasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return isToday(taskDate) && !t.completed;
  });

  // Find next upcoming task
  const nextTask = todayTasks.find(t => new Date(t.dateTime) > now) || todayTasks[0];

  const tomorrowTasks = sortedTasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return isTomorrow(taskDate) && !t.completed;
  });

  const thisWeekTasks = sortedTasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return (
      isThisWeek(taskDate, { weekStartsOn: 1 }) &&
      !isToday(taskDate) &&
      !isTomorrow(taskDate) &&
      !t.completed
    );
  });

  const completedToday = sortedTasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return isToday(taskDate) && t.completed;
  });

  const overdueTasks = sortedTasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return taskDate < startOfDay(now) && !t.completed;
  });

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your day...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <FaSun className="text-yellow-500" />
          Today
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats Overview */}
      <StatsOverview tasks={todayTasks.concat(completedToday)} />

      {/* Next Task Card (Hero) */}
      {nextTask && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-500 dark:text-gray-400">Focus</h2>
          <NextTaskCard task={nextTask} onComplete={handleToggleComplete} />
        </div>
      )}

      {/* Quick Add */}
      <div className="mb-8">
        <QuickAdd onAdd={handleQuickAdd} placeholder="What do you need to do today?" />
      </div>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <TaskSection
          title="Overdue"
          icon={<FaCalendarDay />}
          tasks={overdueTasks}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          accentColor="orange"
          emptyMessage="No overdue tasks"
        />
      )}

      {/* Today's Tasks */}
      <TaskSection
        title="Today"
        icon={<FaSun />}
        tasks={todayTasks}
        onToggleComplete={handleToggleComplete}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        accentColor="blue"
        showDate={false}
        emptyMessage="No tasks for today."
        emptyAction={{
          text: "Plan my day with AI",
          subtext: "Let AI organize your schedule",
          icon: "✨",
          onClick: () => setIsAIModalOpen(true)
        }}
      />

      {/* Tomorrow's Tasks */}
      <TaskSection
        title="Tomorrow"
        icon={<FaCalendarDay />}
        tasks={tomorrowTasks}
        onToggleComplete={handleToggleComplete}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        accentColor="green"
        defaultCollapsed={todayTasks.length > 3}
        emptyMessage="No tasks for tomorrow"
      />

      {/* This Week */}
      {thisWeekTasks.length > 0 && (
        <TaskSection
          title="This Week"
          icon={<FaCalendarWeek />}
          tasks={thisWeekTasks}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          accentColor="purple"
          defaultCollapsed={true}
        />
      )}

      {/* Completed Today */}
      {completedToday.length > 0 && (
        <TaskSection
          title="Completed Today"
          icon={<FaCheckCircle />}
          tasks={completedToday}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          accentColor="gray"
          defaultCollapsed={true}
          showDate={false}
        />
      )}

      <FloatingActionButton onClick={() => setIsAIModalOpen(true)} />
      
      <AIReminderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
