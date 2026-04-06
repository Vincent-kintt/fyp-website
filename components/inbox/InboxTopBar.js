"use client";

import { useTranslations } from "next-intl";
import { Inbox, Download, MoreHorizontal, Loader2 } from "lucide-react";

export default function InboxTopBar({ saveStatus, onExtract, isExtracting }) {
  const t = useTranslations("inbox");

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

        <button aria-label="Actions" className="p-1 rounded">
          <MoreHorizontal
            size={14}
            strokeWidth={1.5}
            style={{ color: "var(--text-muted)" }}
          />
        </button>
      </div>
    </div>
  );
}
