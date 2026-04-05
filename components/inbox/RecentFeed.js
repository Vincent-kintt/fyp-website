"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FiFileText } from "react-icons/fi";
import TaskItem from "@/components/tasks/TaskItem";
import { extractPreview } from "@/lib/notes/preview";

export default function RecentFeed({
  tasks,
  onToggleComplete,
  onDelete,
  onEdit,
}) {
  const t = useTranslations("inbox");
  const tNotes = useTranslations("notes");
  const router = useRouter();
  const [notes, setNotes] = useState([]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setNotes(data.data.slice(0, 5));
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const feed = useMemo(() => {
    const taskItems = tasks.map((t) => ({
      id: t._id || t.id,
      type: "task",
      data: t,
      updatedAt: new Date(t.updatedAt || t.createdAt),
    }));
    const noteItems = notes.map((n) => ({
      id: n.id,
      type: "note",
      data: n,
      updatedAt: new Date(n.updatedAt),
    }));
    return [...taskItems, ...noteItems].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }, [tasks, notes]);

  if (feed.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="text-[11px] font-semibold mb-2 px-1"
        style={{ color: "var(--text-muted)" }}
      >
        {t("recentLabel")} <span className="font-normal">{feed.length}</span>
      </div>
      <div className="space-y-0.5">
        {feed.map((item) => {
          if (item.type === "task") {
            return (
              <TaskItem
                key={item.id}
                task={item.data}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            );
          }
          return (
            <button
              key={item.id}
              onClick={() => router.push(`/notes/${item.id}`)}
              className="w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-2.5"
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--surface-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <FiFileText
                size={14}
                className="mt-0.5 flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {item.data.title || tNotes("untitled")}
                </div>
                <div
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {extractPreview(item.data.content)}
                </div>
              </div>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--accent-light)",
                  color: "var(--accent)",
                }}
              >
                NOTE
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
