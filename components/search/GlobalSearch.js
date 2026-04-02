"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { FaSearch, FaClock, FaPlay, FaCheck, FaPause, FaPlus, FaRobot } from "react-icons/fa";
import { getTagClasses } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";

const CACHE_TTL = 30_000; // 30 seconds

function HighlightText({ text, search }) {
  if (!search || !text) return text;
  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) => {
      regex.lastIndex = 0;
      return regex.test(part) ? (
        <mark key={i} className="bg-yellow-300/40 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      );
    });
  } catch {
    return text;
  }
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const cacheRef = useRef({ data: null, timestamp: 0 });

  const StatusIcon = {
    pending: FaClock,
    in_progress: FaPlay,
    completed: FaCheck,
    snoozed: FaPause,
  };

  // Ctrl+K / Cmd+K shortcut — skip inside inputs
  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch reminders on open with cache
  useEffect(() => {
    if (!open) {
      setSearchValue("");
      return;
    }

    const now = Date.now();
    if (cacheRef.current.data && now - cacheRef.current.timestamp < CACHE_TTL) {
      setReminders(cacheRef.current.data);
      return;
    }

    const fetchReminders = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/reminders");
        const data = await response.json();
        if (data.success) {
          setReminders(data.data);
          cacheRef.current = { data: data.data, timestamp: Date.now() };
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

  // Status-based grouping
  const upcoming = reminders.filter((r) => r.status !== "completed" && r.status !== "snoozed");
  const snoozed = reminders.filter((r) => r.status === "snoozed");
  const completed = reminders.filter((r) => r.status === "completed");

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center gap-1.5"
        aria-label="Search reminders (Ctrl+K)"
        aria-keyshortcuts="Meta+K"
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
        {/* Accessible title (visually hidden for screen readers) */}
        <DialogPrimitive.Title style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
          搜尋提醒事項
        </DialogPrimitive.Title>
        {/* Overlay */}
        <div className="cmdk-overlay" onClick={() => setOpen(false)} />

        <div className="cmdk-panel">
          {/* Input */}
          <div className="cmdk-input-wrapper">
            <FaSearch className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            <Command.Input
              data-testid="global-search-input"
              placeholder="搜尋提醒事項..."
              className="cmdk-input"
              onValueChange={setSearchValue}
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
                找不到符合的提醒事項
              </div>
            </Command.Empty>

            {/* Quick Actions — always visible */}
            <Command.Group heading="快速操作">
              <Command.Item
                value="create new reminder 建立新提醒"
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("open-ai-modal"));
                }}
                className="cmdk-item"
              >
                <FaPlus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>建立新提醒</span>
              </Command.Item>
              <Command.Item
                value="open AI assistant AI 助手"
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("open-ai-modal"));
                }}
                className="cmdk-item"
              >
                <FaRobot className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>AI 助手</span>
              </Command.Item>
            </Command.Group>

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <Command.Group heading="進行中">
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
                          <HighlightText text={r.title} search={searchValue} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {formatDateShort(r.dateTime)}
                          </span>
                          {r.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className={`px-1.5 py-0 rounded text-[10px] font-medium ${getTagClasses(tag)}`}
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

            {/* Snoozed */}
            {snoozed.length > 0 && (
              <Command.Group heading="已延後">
                {snoozed.slice(0, 3).map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                    keywords={r.tags}
                    onSelect={() => handleSelect(r.id)}
                    className="cmdk-item"
                  >
                    <FaPause className="w-3.5 h-3.5 flex-shrink-0 text-purple-500" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        <HighlightText text={r.title} search={searchValue} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-purple-500">
                          延後至 {formatDateShort(r.snoozedUntil)}
                        </span>
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <Command.Group heading="已完成">
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
                        <HighlightText text={r.title} search={searchValue} />
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
