"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSun, FaCalendarDay, FaCalendarWeek, FaCheckCircle } from "react-icons/fa";
import { isToday, isTomorrow, isThisWeek, startOfDay, endOfDay, addDays } from "date-fns";
import TaskSection from "@/components/tasks/TaskSection";
import QuickAdd from "@/components/tasks/QuickAdd";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Categorize tasks by time
  const now = new Date();
  const todayTasks = tasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return isToday(taskDate) && !t.completed;
  });

  const tomorrowTasks = tasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return isTomorrow(taskDate) && !t.completed;
  });

  const thisWeekTasks = tasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return (
      isThisWeek(taskDate, { weekStartsOn: 1 }) &&
      !isToday(taskDate) &&
      !isTomorrow(taskDate) &&
      !t.completed
    );
  });

  const completedToday = tasks.filter((t) => {
    const taskDate = new Date(t.dateTime);
    return isToday(taskDate) && t.completed;
  });

  const overdueTasks = tasks.filter((t) => {
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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
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

      {/* Quick Add */}
      <div className="mb-6">
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
        accentColor="blue"
        showDate={false}
        emptyMessage="No tasks for today. Add one above!"
      />

      {/* Tomorrow's Tasks */}
      <TaskSection
        title="Tomorrow"
        icon={<FaCalendarDay />}
        tasks={tomorrowTasks}
        onToggleComplete={handleToggleComplete}
        onDelete={handleDelete}
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
          accentColor="gray"
          defaultCollapsed={true}
          showDate={false}
        />
      )}
    </div>
  );
}
