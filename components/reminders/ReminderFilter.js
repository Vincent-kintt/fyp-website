"use client";

export default function ReminderFilter({ filters, onFilterChange }) {
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

        <div>
          <select
            value={filters.category || "all"}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
            className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              borderWidth: "1px",
              borderStyle: "solid",
              color: "var(--text-primary)",
            }}
          >
            <option value="all">All Categories</option>
            <option value="personal">Personal</option>
            <option value="work">Work</option>
            <option value="health">Health</option>
            <option value="other">Other</option>
          </select>
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
