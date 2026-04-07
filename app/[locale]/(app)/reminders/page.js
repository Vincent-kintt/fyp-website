"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ReminderList from "@/components/reminders/ReminderList";
import ReminderFilter from "@/components/reminders/ReminderFilter";
import ExportButton from "@/components/reminders/ExportButton";
import { useTasks } from "@/hooks/useTasks";

export default function RemindersPage() {
  const t = useTranslations("reminders");
  const { tasks: reminders, loading, deleteTask, refetch } = useTasks();
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    tag: null,
    type: "all",
  });

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
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            {t("title")}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {t("subtitle")}
          </p>
        </div>
        <ExportButton />
      </div>

      <ReminderFilter filters={filters} onFilterChange={setFilters} />
      <ReminderList
        reminders={filteredReminders}
        onDelete={deleteTask}
        onUpdate={refetch}
      />
    </div>
  );
}
