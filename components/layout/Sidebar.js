"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTheme } from "next-themes";
import {
  FaInbox,
  FaHome,
  FaCalendarAlt,
  FaStickyNote,
  FaList,
  FaChevronLeft,
  FaChevronRight,
  FaSignOutAlt,
  FaSearch,
  FaMoon,
  FaSun,
  FaGlobe,
} from "react-icons/fa";
import NotificationBell from "./NotificationBell";
import { useClickOutside } from "@/hooks/useClickOutside";
import { FiChevronDown, FiChevronRight, FiPlus } from "react-icons/fi";
import useNotes from "@/hooks/useNotes";
import PageTree from "@/components/notes/PageTree";

const PRIMARY_ITEMS = [
  { href: "/inbox", icon: FaInbox, labelKey: "inbox" },
  { href: "/dashboard", icon: FaHome, labelKey: "today" },
  { href: "/calendar", icon: FaCalendarAlt, labelKey: "calendar" },
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
  const [notesExpanded, setNotesExpanded] = useState(false);

  const isNotesPage = pathname?.startsWith("/notes");

  const {
    notes,
    trashedNotes,
    createNote,
    deleteNote,
    reorderNotes,
    renameNote,
    duplicateNote,
    restoreNote,
    permanentDeleteNote,
  } = useNotes();

  const activeNoteId = isNotesPage
    ? pathname.split("/notes/")[1]?.split("/")[0] || null
    : null;

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const locale = useLocale();
  const [wsPopoverOpen, setWsPopoverOpen] = useState(false);
  const wsPopoverRef = useClickOutside(() => setWsPopoverOpen(false));

  useEffect(() => {
    if (!wsPopoverOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setWsPopoverOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wsPopoverOpen]);

  useEffect(() => {
    if (isNotesPage) setNotesExpanded(true);
  }, [isNotesPage]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    const prefix = locale === "zh-TW" ? "" : `/${locale}`;
    await signOut({ callbackUrl: `${prefix}/login` });
  };

  const router = useRouter();
  const { theme, setTheme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;

  const toggleTheme = () => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  const switchLocale = () => {
    const next = locale === "zh-TW" ? "en" : "zh-TW";
    router.replace(pathname, { locale: next });
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
          ${collapsed ? "px-0 py-2" : "px-3 py-2"} rounded-lg text-[14px] font-medium
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
        collapsed ? "w-[56px]" : "w-[240px]"
      }`}
      style={{
        backgroundColor: "var(--navbar-bg)",
        borderColor: "var(--navbar-border)",
      }}
      role="navigation"
      aria-label={t("mainNavigation")}
    >
      <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
        {session?.user ? (
          <div className="relative" ref={wsPopoverRef}>
            <button
              onClick={() => setWsPopoverOpen((p) => !p)}
              className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} rounded-md transition-colors px-1.5 py-1`}
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--surface-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              aria-label="Workspace menu"
              aria-expanded={wsPopoverOpen}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{
                  backgroundColor: "var(--primary-light)",
                  color: "var(--primary)",
                }}
              >
                {(session.user.username || "U")[0].toUpperCase()}
              </div>
              {!collapsed && (
                <>
                  <span
                    className="text-[12.5px] font-medium truncate max-w-[100px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {session.user.username}
                  </span>
                  {session.user.role === "admin" && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: "var(--info-light)",
                        color: "var(--info)",
                      }}
                    >
                      {t("admin")}
                    </span>
                  )}
                  <FiChevronDown
                    size={10}
                    className="flex-shrink-0 ml-auto"
                    style={{ color: "var(--text-muted)" }}
                  />
                </>
              )}
            </button>

            {wsPopoverOpen && (
              <div
                className={`absolute ${collapsed ? "left-full ml-1" : "left-0"} top-full mt-1 w-48 rounded-lg shadow-lg border z-50 py-1`}
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                }}
              >
                <div
                  className="px-3 py-2 border-b"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <div
                    className="text-[12px] font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {session.user.username}
                  </div>
                  {session.user.role === "admin" && (
                    <div
                      className="text-[10px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t("admin")}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--surface-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <FaSignOutAlt size={12} />
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div />
        )}
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
          {collapsed ? (
            <FaChevronRight size={12} />
          ) : (
            <FaChevronLeft size={12} />
          )}
        </button>
      </div>

      <nav className="flex-1 flex flex-col min-h-0 px-2.5 pt-1.5 pb-2">
        {/* Search */}
        <div className="mb-1">
          <button
            onClick={() =>
              window.dispatchEvent(new Event("open-global-search"))
            }
            title={collapsed ? t("search") : undefined}
            className={`
              w-full relative flex items-center ${collapsed ? "justify-center" : "gap-3"}
              ${collapsed ? "px-0 py-2" : "px-3 py-2"} rounded-lg text-[14px] font-medium
              transition-colors duration-150
              text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]
            `}
          >
            <FaSearch size={16} aria-hidden="true" />
            {!collapsed && (
              <>
                <span>{t("search")}</span>
                <kbd
                  className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: "var(--surface-hover)",
                    color: "var(--text-muted)",
                  }}
                >
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        <div className="space-y-1">
          {PRIMARY_ITEMS.map(renderItem)}
        </div>

        <div className={collapsed ? "pt-3" : "mt-3"} />

        {/* Notes section */}
        {!collapsed ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-2 py-1 flex-shrink-0">
              <button
                onClick={() => setNotesExpanded((p) => !p)}
                className="flex items-center gap-1 text-[11px] font-medium"
                style={{ color: "var(--text-muted)", letterSpacing: "0.5px" }}
              >
                {notesExpanded ? (
                  <FiChevronDown size={10} />
                ) : (
                  <FiChevronRight size={10} />
                )}
                NOTES
              </button>
              <button
                onClick={() => createNote(null)}
                className="p-0.5 rounded hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <FiPlus size={13} />
              </button>
            </div>
            {notesExpanded && notes.length > 0 && (
              <div className="flex-1 min-h-0">
                <PageTree
                  notes={notes}
                  activeNoteId={activeNoteId}
                  onCreateNote={createNote}
                  onDeleteNote={deleteNote}
                  onReorder={reorderNotes}
                  onRename={renameNote}
                  onDuplicate={duplicateNote}
                  trashedNotes={trashedNotes}
                  onRestore={restoreNote}
                  onPermanentDelete={permanentDeleteNote}
                />
              </div>
            )}
            {notesExpanded && notes.length === 0 && (
              <div
                className="px-3 py-2 text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                No pages yet
              </div>
            )}
          </div>
        ) : (
          renderItem({ href: "/notes", icon: FaStickyNote, labelKey: "notes" })
        )}
      </nav>

      {/* Bottom utility bar */}
      {session?.user && (
        <div
          className={`flex items-center ${collapsed ? "flex-col justify-center px-2 gap-1" : "px-2.5"} py-2 border-t flex-shrink-0`}
          style={{ borderColor: "var(--navbar-border)" }}
        >
          {!collapsed ? (
            <>
              <div className="flex-1 min-w-0">
                <NotificationBell />
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={switchLocale}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--surface-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  aria-label="Switch language"
                >
                  <FaGlobe size={14} />
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--surface-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  aria-label="Toggle theme"
                >
                  {currentTheme === "dark" ? (
                    <FaSun size={14} className="text-warning" />
                  ) : (
                    <FaMoon size={14} />
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <NotificationBell />
              <button
                onClick={switchLocale}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                aria-label="Switch language"
              >
                <FaGlobe size={14} />
              </button>
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                aria-label="Toggle theme"
              >
                {currentTheme === "dark" ? (
                  <FaSun size={14} className="text-warning" />
                ) : (
                  <FaMoon size={14} />
                )}
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
