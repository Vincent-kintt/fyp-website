"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { File } from "lucide-react";
import { getTagClasses } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";

const CACHE_TTL = 30_000; // 30 seconds

const STATUS_COLORS = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  snoozed: "#a855f7",
};

function SearchIcon({ className, style }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      className={className}
      style={style}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="6.5" cy="6.5" r="5" />
      <line x1="10" y1="10" x2="13.5" y2="13.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="6.5" y1="2" x2="6.5" y2="11" />
      <line x1="2" y1="6.5" x2="11" y2="6.5" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="2" y="2" width="9" height="9" rx="2" />
      <line x1="5" y1="6.5" x2="8" y2="6.5" />
    </svg>
  );
}

function StatusDot({ status }) {
  return (
    <div
      className="cmdk-status-dot"
      style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.pending }}
    />
  );
}

function HighlightText({ text, search }) {
  if (!search || !text) return text;
  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) => {
      regex.lastIndex = 0;
      return regex.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-300/40 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5"
        >
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
  const locale = useLocale();
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const cacheRef = useRef({ data: null, timestamp: 0 });

  // Ctrl+K / Cmd+K shortcut — skip inside inputs
  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        const tag = document.activeElement?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          document.activeElement?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Listen for open-global-search event from sidebar
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-global-search", handler);
    return () => window.removeEventListener("open-global-search", handler);
  }, []);

  // Fetch reminders on open with cache
  useEffect(() => {
    if (!open) {
      setSearchValue("");
      return;
    }

    const now = Date.now();
    if (cacheRef.current.data && now - cacheRef.current.timestamp < CACHE_TTL) {
      const cached = cacheRef.current.data;
      // Handle both old (array) and new (object) cache shapes
      if (Array.isArray(cached)) {
        setReminders(cached);
      } else {
        setReminders(cached.reminders || []);
        setNotes(cached.notes || []);
      }
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [remindersRes, notesRes] = await Promise.all([
          fetch("/api/reminders"),
          fetch("/api/notes"),
        ]);
        const remindersData = await remindersRes.json();
        const notesData = await notesRes.json();
        if (remindersData.success) {
          setReminders(remindersData.data);
        }
        if (notesData.success) {
          setNotes(notesData.data || []);
        }
        cacheRef.current = {
          data: { reminders: remindersData.data || [], notes: notesData.data || [] },
          timestamp: Date.now(),
        };
      } catch (err) {
        console.error("Error fetching search data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open]);

  const handleSelect = useCallback(
    (id) => {
      setOpen(false);
      router.push(`/reminders/${id}`);
    },
    [router],
  );

  const handleSelectNote = useCallback(
    (id) => {
      setOpen(false);
      router.push(`/notes/${id}`);
    },
    [router],
  );

  // Status-based grouping
  const upcoming = reminders.filter(
    (r) => r.status !== "completed" && r.status !== "snoozed",
  );
  const snoozed = reminders.filter((r) => r.status === "snoozed");
  const completed = reminders.filter((r) => r.status === "completed");

  const isBrowsing = !searchValue;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("title")}
      loop
    >
        {/* Accessible title (visually hidden) */}
        <DialogPrimitive.Title className="sr-only">
          {t("title")}
        </DialogPrimitive.Title>

        <div className="cmdk-panel">
          {/* Input */}
          <div className="cmdk-input-wrapper">
            <SearchIcon style={{ color: "var(--cmdk-text-muted)" }} />
            <Command.Input
              data-testid="global-search-input"
              placeholder={t("placeholder")}
              className="cmdk-input"
              onValueChange={setSearchValue}
            />
            <kbd className="cmdk-kbd">⌘K</kbd>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md transition-colors flex-shrink-0"
              style={{ color: "var(--cmdk-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cmdk-text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--cmdk-text-muted)")}
              aria-label="Close search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Results */}
          <Command.List className="cmdk-list">
            {loading && (
              <Command.Loading>
                <div className="flex flex-col gap-1 p-1.5">
                  <div className="cmdk-skeleton" />
                  <div className="cmdk-skeleton" />
                  <div className="cmdk-skeleton" />
                </div>
              </Command.Loading>
            )}

            <Command.Empty>
              <div
                className="py-6 text-center"
                style={{
                  color: "var(--cmdk-text-muted)",
                  fontSize: "0.8125rem",
                }}
              >
                {t("noResults")}
              </div>
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading={t("quickActions")}>
              <Command.Item
                value="create new reminder 建立新提醒"
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("open-ai-modal"));
                }}
                className="cmdk-item"
              >
                <PlusIcon />
                <span className="cmdk-item-title">{t("createNew")}</span>
              </Command.Item>
              <Command.Item
                value="open AI assistant AI 助手"
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("open-ai-modal"));
                }}
                className="cmdk-item"
              >
                <AiIcon />
                <span className="cmdk-item-title">{t("aiAssistant")}</span>
              </Command.Item>
            </Command.Group>

            {/* Notes */}
            {notes.length > 0 && (
              <>
                <div className="cmdk-divider" />
                <Command.Group heading={t("notes")}>
                  {(isBrowsing ? notes.slice(0, 5) : notes).map((n) => (
                    <Command.Item
                      key={`note-${n.id}`}
                      value={n.title || "Untitled"}
                      onSelect={() => handleSelectNote(n.id)}
                      className="cmdk-item"
                    >
                      <File size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                      <span className="cmdk-item-title flex-1 min-w-0 truncate">
                        <HighlightText text={n.title || "Untitled"} search={searchValue} />
                      </span>
                      {isBrowsing && n.updatedAt && (
                        <span className="cmdk-item-date">
                          {formatDateShort(n.updatedAt, locale)}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}

            {/* Divider between actions and reminders */}
            {(upcoming.length > 0 ||
              snoozed.length > 0 ||
              completed.length > 0) && <div className="cmdk-divider" />}

            {/* Upcoming / In Progress */}
            {upcoming.length > 0 && (
              <Command.Group heading={t("inProgress")}>
                {upcoming.slice(0, 6).map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                    keywords={r.tags}
                    onSelect={() => handleSelect(r.id)}
                    className="cmdk-item"
                  >
                    <StatusDot status={r.status} />
                    <span className="cmdk-item-title flex-1 min-w-0 truncate">
                      <HighlightText text={r.title} search={searchValue} />
                    </span>
                    <span className="cmdk-item-date">
                      {formatDateShort(r.dateTime, locale)}
                    </span>
                    {isBrowsing && r.tags?.[0] && (
                      <span
                        className={`px-1.5 py-0 rounded text-[10px] font-medium flex-shrink-0 ${getTagClasses(r.tags[0])}`}
                      >
                        {r.tags[0]}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Snoozed */}
            {snoozed.length > 0 && (
              <>
                {upcoming.length > 0 && <div className="cmdk-divider" />}
                <Command.Group heading={t("snoozed")}>
                  {snoozed.slice(0, 3).map((r) => (
                    <Command.Item
                      key={r.id}
                      value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                      keywords={r.tags}
                      onSelect={() => handleSelect(r.id)}
                      className="cmdk-item"
                    >
                      <StatusDot status="snoozed" />
                      <span className="cmdk-item-title flex-1 min-w-0 truncate">
                        <HighlightText text={r.title} search={searchValue} />
                      </span>
                      <span className="cmdk-item-date">
                        {t("snoozedUntil", {
                          date: formatDateShort(r.snoozedUntil, locale),
                        })}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <>
                {(upcoming.length > 0 || snoozed.length > 0) && (
                  <div className="cmdk-divider" />
                )}
                <Command.Group heading={t("completed")}>
                  {completed.slice(0, 4).map((r) => (
                    <Command.Item
                      key={r.id}
                      value={`${r.title} ${r.description || ""} ${(r.tags || []).join(" ")}`}
                      keywords={r.tags}
                      onSelect={() => handleSelect(r.id)}
                      className="cmdk-item"
                    >
                      <StatusDot status="completed" />
                      <span className="cmdk-item-title flex-1 min-w-0 truncate">
                        <HighlightText text={r.title} search={searchValue} />
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}
          </Command.List>

          {/* Footer with keyboard hints */}
          <div className="cmdk-footer">
            <span className="cmdk-footer-hint">
              <kbd>↑↓</kbd> navigate
            </span>
            <span className="cmdk-footer-hint">
              <kbd>↵</kbd> open
            </span>
            <span className="cmdk-footer-hint">
              <kbd>esc</kbd> close
            </span>
          </div>
        </div>
    </Command.Dialog>
  );
}
