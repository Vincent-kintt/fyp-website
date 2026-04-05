// components/layout/BottomNav.js
"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  FaHome,
  FaInbox,
  FaCalendarAlt,
  FaStickyNote,
} from "react-icons/fa";
import { useVirtualKeyboard } from "@/hooks/useVirtualKeyboard";

const TABS = [
  { href: "/inbox", icon: FaInbox, labelKey: "inbox" },
  { href: "/dashboard", icon: FaHome, labelKey: "today" },
  { href: "/calendar", icon: FaCalendarAlt, labelKey: "calendar" },
  { href: "/notes", icon: FaStickyNote, labelKey: "notes" },
];

export default function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isKeyboardOpen = useVirtualKeyboard();

  const getActiveIndex = () => {
    for (let i = 0; i < TABS.length; i++) {
      const { href } = TABS[i];
      if (href === "/dashboard") {
        if (pathname === "/dashboard") return i;
      } else if (pathname.startsWith(href)) {
        return i;
      }
    }
    return -1;
  };

  const activeIndex = getActiveIndex();

  return (
    <nav
      role="navigation"
      aria-label={t("mainNavigation")}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        transform: isKeyboardOpen ? "translateY(100%)" : "translateY(0)",
        transition: "transform 200ms cubic-bezier(0.3, 0, 0.8, 0.15)",
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .bottom-nav-pill { transition: none !important; }
          .bottom-nav-item-icon { transition: none !important; }
          .bottom-nav-item-label { transition: none !important; }
        }
        .dark .bottom-nav-pill {
          background-color: rgba(59, 130, 246, 0.15) !important;
        }
      `}</style>

      <div
        className="relative flex bg-[var(--navbar-bg)]"
        style={{
          height: "calc(60px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -1px 0 var(--navbar-border)",
        }}
      >
        {activeIndex >= 0 && (
          <span
            className="bottom-nav-pill pointer-events-none absolute top-[8px] h-[44px] rounded-[10px]"
            style={{
              width: `calc(${100 / TABS.length}% * 0.8)`,
              left: `calc(${100 / TABS.length}% * ${activeIndex} + ${100 / TABS.length}% * 0.1)`,
              backgroundColor: "var(--primary-light)",
              transition: "left 240ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
        )}

        {TABS.map((tab, index) => {
          const isActive = index === activeIndex;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              aria-label={t(tab.labelKey)}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              style={{
                color: isActive ? "var(--primary)" : "var(--text-muted)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Icon
                aria-hidden="true"
                className="bottom-nav-item-icon h-[18px] w-[18px]"
                style={{
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                  transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              />
              <span
                className="bottom-nav-item-label text-[11px] font-medium leading-none"
                style={{
                  transition: "color 150ms ease",
                }}
              >
                {t(tab.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
