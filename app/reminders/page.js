"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FaPlus } from "react-icons/fa";
import { toast } from "sonner";
import ReminderList from "@/components/reminders/ReminderList";
import ReminderFilter from "@/components/reminders/ReminderFilter";
import AIReminderModal from "@/components/reminders/AIReminderModal";

export default function RemindersPage() {
  const { data: session } = useSession();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    tag: null,
    type: "all",
  });

  // Fetch reminders from API
  const fetchReminders = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch("/api/reminders");
      const data = await response.json();

      if (data.success) {
        setReminders(data.data);
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchReminders();
    }
  }, [session]);

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setReminders(reminders.filter((reminder) => reminder.id !== id));
        toast.success("Reminder deleted");
      } else {
        toast.error("Failed to delete reminder");
      }
    } catch (error) {
      console.error("Error deleting reminder:", error);
      toast.error("Failed to delete reminder");
    }
  };

  const handleUpdate = (updatedReminder) => {
    setReminders(
      reminders.map((r) =>
        r.id === updatedReminder.id ? { ...r, ...updatedReminder } : r,
      ),
    );
  };

  const filteredReminders = reminders.filter((reminder) => {
    const matchesSearch =
      reminder.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      reminder.description
        ?.toLowerCase()
        .includes(filters.search.toLowerCase());
    const matchesCategory =
      filters.category === "all" || reminder.category === filters.category;
    const matchesTag =
      !filters.tag || (reminder.tags && reminder.tags.includes(filters.tag));
    const matchesType =
      filters.type === "all" ||
      (filters.type === "recurring" && reminder.recurring) ||
      (filters.type === "one-time" && !reminder.recurring);

    return matchesSearch && matchesCategory && matchesTag && matchesType;
  });

  if (loading) {
    return (
      <div className="relative">
        <div className="mb-8">
          <div className="skeleton-line h-8 w-48 mb-2" />
          <div className="skeleton-line h-4 w-72" />
        </div>
        {/* Filter skeleton */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-line h-8 w-20 rounded-full" />
          ))}
        </div>
        {/* List skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="skeleton-line w-5 h-5 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="skeleton-line h-4 w-3/4 mb-2" />
                <div className="skeleton-line h-3 w-1/2 mb-1" />
                <div className="skeleton-line h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          My Reminders
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Manage all your reminders in one place
        </p>
      </div>

      <ReminderFilter filters={filters} onFilterChange={setFilters} />
      <ReminderList
        reminders={filteredReminders}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />

      {/* Floating Add Button */}
      <button
        onClick={() => setIsPanelOpen(true)}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110 z-30 flex items-center justify-center"
        aria-label="Create new reminder"
      >
        <FaPlus className="text-2xl" />
      </button>

      {/* AI Reminder Modal */}
      <AIReminderModal
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onSuccess={() => fetchReminders({ silent: true })}
      />
    </div>
  );
}
