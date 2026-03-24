"use client";

import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { FaSearch, FaClock, FaPlay, FaCheck, FaPause, FaTag } from "react-icons/fa";
import { format } from "date-fns";
import { getTagClasses } from "@/lib/utils";

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch reminders on open
  useEffect(() => {
    if (!open) return;

    const fetchReminders = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/reminders");
        const data = await response.json();
        if (data.success) {
          setReminders(data.data);
        }
      } catch (err) {
        console.error("Error fetching reminders:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReminders();
  }, [open]);

  const handleSelect = useCallback(
    (id) => {
      setOpen(false);
      router.push(`/reminders/${id}`);
    },
    [router]
  );

  const StatusIcon = {
    pending: FaClock,
    in_progress: FaPlay,
    completed: FaCheck,
    snoozed: FaPause,
  };

  const formatDate = (dateTime) => {
    try {
      return format(new Date(dateTime), "MMM dd, hh:mm a");
    } catch {
      return "";
    }
  };

  const upcoming = reminders.filter((r) => !r.completed);
  const completed = reminders.filter((r) => r.completed);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center gap-1.5"
        aria-label="Search reminders"
      >
        <FaSearch className="w-4 h-4" />
        <span className="hidden sm:inline">Search</span>
      </button>

      {/* Command palette */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search reminders"
        loop
      >
        {/* Overlay */}
        <div className="cmdk-overlay" onClick={() => setOpen(false)} />

        <div className="cmdk-panel">
          {/* Input */}
          <div className="cmdk-input-wrapper">
            <FaSearch className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            <Command.Input
              placeholder="Search reminders..."
              className="cmdk-input"
            />
            <kbd className="cmdk-kbd">ESC</kbd>
          </div>

          {/* Results */}
          <Command.List className="cmdk-list">
            {loading && (
              <Command.Loading>
                <div className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading...
                </div>
              </Command.Loading>
            )}

            <Command.Empty>
              <div className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No reminders found.
              </div>
            </Command.Empty>

            {upcoming.length > 0 && (
              <Command.Group heading="Upcoming">
                {upcoming.slice(0, 6).map((r) => {
                  const Icon = StatusIcon[r.status] || FaClock;
                  return (
                    <Command.Item
                      key={r.id}
                      value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                      keywords={r.tags}
                      onSelect={() => handleSelect(r.id)}
                      className="cmdk-item"
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {r.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {formatDate(r.dateTime)}
                          </span>
                          {r.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className={`px-1.5 py-0 rounded-full text-[10px] font-medium border ${getTagClasses(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {completed.length > 0 && (
              <Command.Group heading="Completed">
                {completed.slice(0, 4).map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                    keywords={r.tags}
                    onSelect={() => handleSelect(r.id)}
                    className="cmdk-item"
                  >
                    <FaCheck className="w-3.5 h-3.5 flex-shrink-0 text-success" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm" style={{ color: "var(--text-muted)" }}>
                        {r.title}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}
