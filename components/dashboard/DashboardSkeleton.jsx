"use client";

import ReminderRowSkeleton from "@/components/reminders/ReminderRowSkeleton.jsx";

export default function DashboardSkeleton() {
  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="skeleton-line h-7 w-32 mb-2" />
        <div className="skeleton-line h-4 w-48" />
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div className="skeleton-line h-3 w-16 mb-2" />
            <div className="skeleton-line h-6 w-10" />
          </div>
        ))}
      </div>
      {/* Next task card skeleton */}
      <div
        className="rounded-2xl p-6 mb-8"
        style={{
          background:
            "linear-gradient(135deg, var(--glass-bg), var(--glass-bg-hover))",
        }}
      >
        <div className="skeleton-line h-3 w-20 mb-3" />
        <div className="skeleton-line h-6 w-3/4 mb-2" />
        <div className="skeleton-line h-4 w-1/2" />
      </div>
      {/* Task list skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <ReminderRowSkeleton key={i} metaLines={1} />
        ))}
      </div>
    </div>
  );
}
