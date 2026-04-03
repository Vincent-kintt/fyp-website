"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import NoteIcon from "./NoteIcon";
import { formatDistanceToNow } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useClickOutside } from "@/hooks/useClickOutside";

const localeMap = { "zh-TW": zhTW, en: enUS };

export default function NoteTopBar({
  note,
  ancestors,
  saveStatus,
  locale,
  onRename,
  onDuplicate,
  onDelete,
}) {
  const t = useTranslations("notes");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false));

  const dateFnsLocale = localeMap[locale] || enUS;

  const getStatusText = () => {
    if (saveStatus === "saving") return t("saving");
    if (saveStatus === "saved") return t("saved");
    if (note?.updatedAt) {
      const time = formatDistanceToNow(new Date(note.updatedAt), {
        addSuffix: false,
        locale: dateFnsLocale,
      });
      return t("editedAgo", { time });
    }
    return null;
  };

  return (
    <div className="notes-topbar">
      <div className="notes-topbar-breadcrumb">
        {ancestors && ancestors.length > 0 ? (
          <>
            {ancestors.map((ancestor, i) => (
              <span key={ancestor.id} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    size={10}
                    strokeWidth={1.5}
                    style={{ color: "var(--text-muted)", flexShrink: 0 }}
                  />
                )}
                <Link href={`/notes/${ancestor.id}`} className="flex items-center gap-1">
                  <NoteIcon icon={ancestor.icon} hasChildren={false} expanded={false} size={12} fallbackOpacity={0.4} />
                  {ancestor.title || t("untitled")}
                </Link>
              </span>
            ))}
            <ChevronRight
              size={10}
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)", flexShrink: 0 }}
            />
            <span className="current truncate">{note?.title || t("untitled")}</span>
          </>
        ) : (
          <span className="current flex items-center gap-1.5">
            <NoteIcon icon={note?.icon} hasChildren={false} expanded={false} size={14} fallbackOpacity={0.5} />
            {note?.title || t("untitled")}
          </span>
        )}
      </div>

      <div className="notes-topbar-actions">
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {getStatusText()}
        </span>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-20 min-w-[160px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
              role="menu"
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRename?.();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                role="menuitem"
              >
                <Pencil size={14} strokeWidth={1.5} /> {t("rename")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate?.();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                role="menuitem"
              >
                <Copy size={14} strokeWidth={1.5} /> {t("duplicate")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete?.();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--danger)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                role="menuitem"
              >
                <Trash2 size={14} strokeWidth={1.5} /> {t("delete")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
