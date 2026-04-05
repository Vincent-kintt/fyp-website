"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  FaInbox,
  FaHome,
  FaCalendarAlt,
  FaStickyNote,
  FaList,
} from "react-icons/fa";

const PRIMARY_ITEMS = [
  { href: "/inbox", icon: FaInbox, labelKey: "inbox" },
  { href: "/dashboard", icon: FaHome, labelKey: "today" },
  { href: "/calendar", icon: FaCalendarAlt, labelKey: "calendar" },
];

const WORKSPACE_ITEMS = [
  { href: "/notes", icon: FaStickyNote, labelKey: "notes" },
  { href: "/reminders", icon: FaList, labelKey: "all" },
];

function isActive(pathname, href) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { data: session } = useSession();

  const renderItem = ({ href, icon: Icon, labelKey }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`
          relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium
          transition-colors duration-150
          ${
            active
              ? "bg-[var(--primary-light)] text-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          }
        `}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm"
            style={{ backgroundColor: "var(--primary)" }}
          />
        )}
        <Icon size={16} aria-hidden="true" />
        <span>{t(labelKey)}</span>
      </Link>
    );
  };

  return (
    <aside
      className="hidden md:flex flex-col w-[210px] flex-shrink-0 border-r"
      style={{
        backgroundColor: "var(--navbar-bg)",
        borderColor: "var(--navbar-border)",
      }}
      role="navigation"
      aria-label={t("mainNavigation")}
    >
      <nav className="flex-1 px-2.5 py-4 space-y-1">
        {PRIMARY_ITEMS.map(renderItem)}

        <div
          className="pt-4 pb-1.5 px-3 text-[10px] font-medium uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Workspace
        </div>

        {WORKSPACE_ITEMS.map(renderItem)}
      </nav>

      {session?.user && (
        <div
          className="px-3 py-3 border-t"
          style={{ borderColor: "var(--navbar-border)" }}
        >
          <div className="flex items-center gap-2.5 px-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold"
              style={{
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              {(session.user.name || "U")[0].toUpperCase()}
            </div>
            <span
              className="text-[12.5px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {session.user.name}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
