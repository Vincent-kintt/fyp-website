"use client";
import { useTranslations } from "next-intl";

// Maps view keys to i18n keys in calendar namespace
const VIEW_KEYS = ["day", "week", "monthView", "agenda"];

export default function ViewTabs({ activeView, onViewChange, availableViews }) {
  const t = useTranslations("calendar");
  const views = availableViews ?? VIEW_KEYS;

  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-lg"
      style={{ background: "var(--card-bg)" }}
      role="tablist"
    >
      {views.map((view) => (
        <button
          key={view}
          role="tab"
          aria-selected={activeView === view}
          onClick={() => onViewChange(view)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            activeView === view
              ? "bg-[var(--background)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {t(view)}
        </button>
      ))}
    </div>
  );
}
