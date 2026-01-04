"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import TaskItem from "@/components/tasks/TaskItem";

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

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

  // Get tasks for a specific date
  const getTasksForDate = (date) => {
    return tasks.filter((task) => isSameDay(new Date(task.dateTime), date));
  };

  // Get tasks for selected date
  const selectedDateTasks = getTasksForDate(selectedDate);

  // Calendar rendering
  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:opacity-70 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:opacity-70 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <FaChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium py-2"
            style={{ color: "var(--text-muted)" }}
          >
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const dayTasks = getTasksForDate(currentDay);
        const isSelected = isSameDay(currentDay, selectedDate);
        const isCurrentMonth = isSameMonth(currentDay, monthStart);
        const isTodayDate = isToday(currentDay);

        days.push(
          <button
            key={currentDay.toString()}
            onClick={() => setSelectedDate(currentDay)}
            className="relative p-2 h-12 flex flex-col items-center justify-start rounded-lg transition-all"
            style={{
              backgroundColor: isSelected ? "#2563eb" : isTodayDate ? "rgba(59, 130, 246, 0.1)" : "transparent",
              color: isSelected ? "#ffffff" : isTodayDate ? "#2563eb" : isCurrentMonth ? "var(--text-primary)" : "var(--text-muted)",
              opacity: isCurrentMonth ? 1 : 0.4,
            }}
            onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)")}
            onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = isTodayDate ? "rgba(59, 130, 246, 0.1)" : "transparent")}
          >
            <span className="text-sm">{format(currentDay, "d")}</span>
            {dayTasks.length > 0 && (
              <div className="flex gap-0.5 mt-0.5">
                {dayTasks.slice(0, 3).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 h-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-blue-500"
                    }`}
                  />
                ))}
              </div>
            )}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1">
          {days}
        </div>
      );
      days = [];
    }
    return <div className="space-y-1">{rows}</div>;
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <FaCalendarAlt className="text-blue-500" />
          Calendar
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          View your tasks by date
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div 
          className="lg:col-span-2 rounded-xl p-4 shadow-sm"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>

        {/* Selected Date Tasks */}
        <div 
          className="rounded-xl p-4 shadow-sm"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            {isToday(selectedDate)
              ? "Today"
              : format(selectedDate, "EEEE, MMM d")}
          </h3>
          <div className="space-y-2">
            {selectedDateTasks.length > 0 ? (
              selectedDateTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDelete}
                  showDate={false}
                />
              ))
            ) : (
              <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
                No tasks for this day
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
