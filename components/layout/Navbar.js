"use client";

import { Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useTranslations, useLocale } from "next-intl";
import {
  FaBell,
  FaMoon,
  FaSun,
  FaGlobe,
  FaEllipsisH,
  FaList,
} from "react-icons/fa";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import GlobalSearch from "../search/GlobalSearch";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { data: session, status } = useSession();
  const { theme, setTheme, systemTheme } = useTheme();
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) {
        setOverflowOpen(false);
      }
    };
    if (overflowOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowOpen]);

  const toggleTheme = () => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  const switchLocale = () => {
    const next = locale === "zh-TW" ? "en" : "zh-TW";
    router.replace(pathname, { locale: next });
  };

  // Get current theme, accounting for system preference
  const currentTheme = theme === "system" ? systemTheme : theme;

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <nav className="bg-navbar-bg shadow-md border-b border-navbar-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <FaBell className="text-primary text-2xl" />
              <span className="text-xl font-bold text-text-primary">{t("appName")}</span>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-navbar-bg shadow-md border-b border-navbar-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <FaBell className="text-primary text-2xl" />
            <span className="text-xl font-bold text-text-primary">{t("appName")}</span>
          </Link>

          {/* Utility Items */}
          <div className="flex items-center space-x-4 sm:space-x-6">
            {session ? (
              <>
                <GlobalSearch />

                <NotificationBell />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-text-secondary hover:text-primary transition-colors font-medium"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/register"
                  className="bg-primary text-text-inverted px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors font-medium"
                >
                  {t("register")}
                </Link>
              </>
            )}

            {/* Mobile overflow menu */}
            {session && (
              <div className="relative md:hidden" ref={overflowRef}>
                <button
                  onClick={() => setOverflowOpen((prev) => !prev)}
                  className="p-2 rounded-lg bg-background-tertiary text-text-primary hover:bg-surface-active transition-colors"
                  aria-label={t("more")}
                  aria-expanded={overflowOpen}
                >
                  <FaEllipsisH className="text-sm" />
                </button>
                {overflowOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-50 py-1"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <Link
                      href="/reminders"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors"
                      style={{ color: "var(--text-primary)" }}
                      onClick={() => setOverflowOpen(false)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--surface-hover)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <FaList size={14} style={{ color: "var(--text-muted)" }} />
                      {t("all")}
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Locale Switcher */}
            <button
              onClick={switchLocale}
              className="p-2 rounded-lg bg-background-tertiary text-text-primary hover:bg-surface-active transition-colors flex items-center gap-1"
              aria-label="Switch language"
            >
              <FaGlobe className="text-sm" />
              <span className="text-xs font-medium">{locale === "zh-TW" ? "EN" : "中"}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-background-tertiary text-text-primary hover:bg-surface-active transition-colors"
              aria-label={t("toggleTheme")}
            >
              {currentTheme === "dark" ? (
                <FaSun className="text-lg text-warning" />
              ) : (
                <FaMoon className="text-lg" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
