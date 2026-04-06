"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, Download, MoreHorizontal, Loader2, Trash2, RotateCcw } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";

export default function InboxTopBar({ saveStatus, onExtract, isExtracting, onClearTasks, onResetInbox }) {
  const t = useTranslations("inbox");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false));

  const getStatusText = () => {
    if (saveStatus === "saving") return t("subtitle");
    if (saveStatus === "saved") return t("completed");
    return null;
  };

  return (
    <div className="notes-topbar">
      <div className="flex items-center gap-1.5 min-w-0">
        <Inbox
          size={14}
          strokeWidth={1.5}
          style={{ color: "var(--text-muted)", flexShrink: 0 }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("title")}
        </span>
      </div>

      <div className="notes-topbar-actions">
        {getStatusText() && (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {getStatusText()}
          </span>
        )}

        <button
          onClick={onExtract}
          disabled={isExtracting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--text-inverted)",
          }}
        >
          {isExtracting ? (
            <Loader2 size={12} strokeWidth={2} className="animate-spin" />
          ) : (
            <Download size={12} strokeWidth={2} />
          )}
          {isExtracting ? t("extracting") : t("extractTasks")}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="Actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
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
                  onClearTasks?.();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--danger)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                role="menuitem"
              >
                <Trash2 size={14} strokeWidth={1.5} />
                {t("clearTasks")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onResetInbox?.();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--danger)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                role="menuitem"
              >
                <RotateCcw size={14} strokeWidth={1.5} />
                {t("resetInbox")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
