"use client";

export default function ReminderRowSkeleton({ metaLines = 1 }) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl"
      style={{
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
      }}
    >
      <div className="skeleton-line w-5 h-5 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <div className="skeleton-line h-4 w-3/4 mb-2" />
        {metaLines === 1 ? (
          <div className="skeleton-line h-3 w-1/3" />
        ) : (
          <>
            <div className="skeleton-line h-3 w-1/2 mb-1" />
            <div className="skeleton-line h-3 w-1/4" />
          </>
        )}
      </div>
    </div>
  );
}
