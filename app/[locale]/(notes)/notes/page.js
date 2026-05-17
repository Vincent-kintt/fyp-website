"use client";

import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FiFileText, FiPlus, FiClock } from "react-icons/fi";
import { extractPreview } from "@/lib/notes/preview";
import { formatRelativeTime } from "@/lib/format";
import useNotes from "@/hooks/useNotes";

export default function NotesPage() {
  const t = useTranslations("notes");
  const locale = useLocale();
  const router = useRouter();
  const { notes, loading, createNote } = useNotes();

  const formatTime = (dateStr) => {
    const time = formatRelativeTime(dateStr, locale);
    if (!time) return "";
    return t("editedAgo", { time });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-lg animate-pulse"
            style={{ backgroundColor: "var(--surface-hover)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1
          className="text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {t("title")}
        </h1>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FiFileText
            size={32}
            className="mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            {t("emptyState")}
          </p>
          <button
            onClick={() => createNote()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--primary-light)",
              color: "var(--primary)",
            }}
          >
            {t("emptyStateAction")}
          </button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => router.push(`/notes/${note.id}`)}
              className="w-full text-left p-3 rounded-lg transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--surface-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <FiFileText size={14} style={{ color: "var(--text-muted)" }} />
                <span className="font-semibold text-[13.5px]">
                  {note.title || t("untitled")}
                </span>
              </div>
              <p
                className="text-[11.5px] line-clamp-2 ml-[22px]"
                style={{ color: "var(--text-muted)" }}
              >
                {extractPreview(note.content)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 ml-[22px]">
                <FiClock size={10} style={{ color: "var(--text-muted)" }} />
                <span
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatTime(note.updatedAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <button
          onClick={() => createNote()}
          className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 z-40"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--text-inverted)",
            boxShadow: "0 4px 16px rgba(91,141,239,0.3)",
          }}
          aria-label={t("newPage")}
        >
          <FiPlus size={20} />
        </button>
      )}
    </div>
  );
}
