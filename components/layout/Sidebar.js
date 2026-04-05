"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  FaInbox,
  FaHome,
  FaCalendarAlt,
  FaStickyNote,
  FaList,
  FaChevronLeft,
  FaChevronRight,
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

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const renderItem = ({ href, icon: Icon, labelKey }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? t(labelKey) : undefined}
        className={`
          relative flex items-center ${collapsed ? "justify-center" : "gap-3"}
          ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"} rounded-lg text-[13.5px] font-medium
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
        {!collapsed && <span>{t(labelKey)}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`hidden md:flex flex-col flex-shrink-0 border-r transition-[width] duration-200 ease-out ${
        collapsed ? "w-[56px]" : "w-[210px]"
      }`}
      style={{
        backgroundColor: "var(--navbar-bg)",
        borderColor: "var(--navbar-border)",
      }}
      role="navigation"
      aria-label={t("mainNavigation")}
    >
      <div className="flex items-center justify-end px-2.5 pt-3 pb-1">
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--surface-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <FaChevronRight size={12} /> : <FaChevronLeft size={12} />}
        </button>
      </div>

      <nav className="flex-1 px-2.5 py-4 space-y-1">
        {PRIMARY_ITEMS.map(renderItem)}

        {!collapsed && (
          <div
            className="pt-4 pb-1.5 px-3 text-[10px] font-medium uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            {t("workspace")}
          </div>
        )}
        {collapsed && <div className="pt-3" />}

        {WORKSPACE_ITEMS.map(renderItem)}
      </nav>

      {session?.user && (
        <div
          className={`${collapsed ? "px-2" : "px-3"} py-3 border-t`}
          style={{ borderColor: "var(--navbar-border)" }}
        >
          <div
            className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-2"}`}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
              style={{
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              {(session.user.name || "U")[0].toUpperCase()}
            </div>
            {!collapsed && (
              <span
                className="text-[12.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {session.user.name}
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
