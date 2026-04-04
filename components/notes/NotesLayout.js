"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronsLeft, Menu, PanelLeft } from "lucide-react";
import PageTree from "./PageTree";
import MobileSidebar from "./MobileSidebar";

const STORAGE_KEY_COLLAPSED = "notes-sidebar-collapsed";
const STORAGE_KEY_WIDTH = "notes-sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

function getInitialCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
  } catch {
    return false;
  }
}

function getInitialWidth() {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY_WIDTH), 10);
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export default function NotesLayout({
  notes,
  activeNoteId,
  onCreateNote,
  onDeleteNote,
  onReorder,
  onRename,
  onDuplicate,
  trashedNotes,
  onRestore,
  onPermanentDelete,
  children,
}) {
  const t = useTranslations("notes");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    setCollapsed(getInitialCollapsed());
    setSidebarWidth(getInitialWidth());
  }, []);
  const [isResizing, setIsResizing] = useState(false);
  const [peekVisible, setPeekVisible] = useState(false);
  const peekTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth));
    } catch {
      /* ignore */
    }
  }, [sidebarWidth]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, moveEvent.clientX),
      );
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleResizeDoubleClick = useCallback(() => {
    setSidebarWidth(DEFAULT_WIDTH);
  }, []);

  const showPeek = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    peekTimerRef.current = setTimeout(() => setPeekVisible(true), 200);
  }, []);

  const hidePeek = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => setPeekVisible(false), 300);
  }, []);

  const handlePeekNoteClick = useCallback(() => {
    setPeekVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const treeProps = {
    notes,
    activeNoteId,
    onCreateNote,
    onDeleteNote,
    onReorder,
    onRename,
    onDuplicate,
    trashedNotes,
    onRestore,
    onPermanentDelete,
  };

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside
        className="notes-sidebar hidden md:flex flex-col"
        style={{
          width: collapsed ? 0 : sidebarWidth,
          minWidth: collapsed ? 0 : sidebarWidth,
          boxShadow: collapsed ? "none" : "1px 0 0 0 var(--border)",
          overflow: "hidden",
          transition: isResizing
            ? "none"
            : "width 200ms ease-out, min-width 200ms ease-out",
        }}
      >
        {/* Sidebar header with collapse button */}
        <div
          className="flex items-center justify-between px-2 pt-2 pb-0"
          style={{ minWidth: sidebarWidth }}
        >
          <span
            className="text-xs font-medium px-1"
            style={{ color: "var(--text-muted)", opacity: 0.6 }}
          >
            {t("title")}
          </span>
          <button
            onClick={toggleCollapse}
            className="p-1 rounded"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--surface-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            aria-label={t("collapseSidebar")}
          >
            <ChevronsLeft size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div
          style={{ minWidth: sidebarWidth }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <PageTree {...treeProps} />
        </div>
        {/* Resize handle */}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("resizeSidebar")}
            tabIndex={0}
            className="notes-sidebar-resize-handle"
            onMouseDown={handleResizeStart}
            onDoubleClick={handleResizeDoubleClick}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setSidebarWidth((w) => Math.min(MAX_WIDTH, w + 16));
              if (e.key === "ArrowLeft") setSidebarWidth((w) => Math.max(MIN_WIDTH, w - 16));
            }}
            data-resizing={isResizing}
          />
        )}
      </aside>

      {/* Expand button (desktop, when collapsed) */}
      {collapsed && (
        <button
          onClick={toggleCollapse}
          className="hidden md:flex fixed z-30 p-2 rounded-lg items-center justify-center"
          style={{
            top: "4.75rem",
            left: "0.75rem",
            color: "var(--text-muted)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--surface-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--surface)")
          }
          aria-label={t("expandSidebar")}
        >
          <PanelLeft size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* Hover peek trigger zone (desktop, when collapsed) */}
      {collapsed && !peekVisible && (
        <div
          className="hidden md:block fixed top-16 left-0 bottom-0 z-20"
          style={{ width: "12px" }}
          onMouseEnter={showPeek}
        />
      )}

      {/* Peek overlay (desktop, when collapsed) */}
      {collapsed && peekVisible && (
        <>
          <div
            className="notes-drawer-backdrop hidden md:block"
            onClick={() => setPeekVisible(false)}
            aria-hidden="true"
          />
          <aside
            className="notes-peek-overlay hidden md:flex flex-col"
            style={{ width: sidebarWidth }}
            onMouseLeave={hidePeek}
            onMouseEnter={() => {
              if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
              }
            }}
          >
            <div onClick={handlePeekNoteClick}>
              <PageTree {...treeProps} />
            </div>
          </aside>
        </>
      )}

      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-[4.5rem] left-4 z-30 p-2 rounded-lg"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        onClick={() => setDrawerOpen(true)}
        aria-label={t("openSidebar")}
      >
        <Menu
          size={16}
          strokeWidth={1.5}
          style={{ color: "var(--text-secondary)" }}
        />
      </button>

      <MobileSidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        {...treeProps}
      />

      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--surface)" }}
      >
        {children}
      </main>
    </div>
  );
}
