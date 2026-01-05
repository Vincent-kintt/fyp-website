"use client";

import { getTagClasses } from "@/lib/utils";

export default function ReminderFilter({ filters, onFilterChange, availableTags = [] }) {
  return (
    <div 
      className="p-4 rounded-lg shadow-md mb-6"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
        borderWidth: "1px",
        borderStyle: "solid",
      }}
    >
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search reminders..."
            value={filters.search || ""}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              borderWidth: "1px",
              borderStyle: "solid",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Tag Filter - Quick Tags */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {["work", "personal", "health", "urgent"].map((tag) => (
            <button
              key={tag}
              onClick={() => {
                const currentTag = filters.tag;
                onFilterChange({ 
                  ...filters, 
                  tag: currentTag === tag ? null : tag,
                  category: "all" 
                });
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                filters.tag === tag
                  ? getTagClasses(tag)
                  : "border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20"
              }`}
              style={{ color: filters.tag === tag ? undefined : "var(--text-secondary)" }}
            >
              {tag}
            </button>
          ))}
          {filters.tag && (
            <button
              onClick={() => onFilterChange({ ...filters, tag: null })}
              className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div>
          <select
            value={filters.type || "all"}
            onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
            className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              borderWidth: "1px",
              borderStyle: "solid",
              color: "var(--text-primary)",
            }}
          >
            <option value="all">All Types</option>
            <option value="one-time">One-time</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>
      </div>
    </div>
  );
}
