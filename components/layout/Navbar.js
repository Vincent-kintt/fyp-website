"use client";

import { Link } from "@/i18n/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useTranslations, useLocale } from "next-intl";
import {
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaHome,
  FaInbox,
  FaCalendarAlt,
  FaList,
  FaGlobe,
  FaStickyNote,
} from "react-icons/fa";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import Button from "../ui/Button";
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    const prefix = locale === "zh-TW" ? "" : `/${locale}`;
    await signOut({ callbackUrl: `${prefix}/login` });
  };

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

          {/* Navigation Links */}
          <div className="flex items-center space-x-4 sm:space-x-6">
            {session ? (
              <>
                <div className="hidden md:flex items-center space-x-4 sm:space-x-6">
                  <Link
                    href="/dashboard"
                    aria-label={t("today")}
                    className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px]"
                  >
                    <FaHome className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("today")}</span>
                  </Link>
                  <Link
                    href="/inbox"
                    aria-label={t("inbox")}
                    className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px]"
                  >
                    <FaInbox className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("inbox")}</span>
                  </Link>
                  <Link
                    href="/calendar"
                    aria-label={t("calendar")}
                    className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px]"
                  >
                    <FaCalendarAlt className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("calendar")}</span>
                  </Link>
                  <Link
                    href="/reminders"
                    aria-label={t("all")}
                    className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px]"
                  >
                    <FaList className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("all")}</span>
                  </Link>
                  <Link
                    href="/notes"
                    aria-label={t("notes")}
                    className="text-text-secondary hover:text-primary transition-colors font-medium flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px]"
                  >
                    <FaStickyNote className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("notes")}</span>
                  </Link>
                </div>

                <GlobalSearch />

                <NotificationBell />

                {/* User Info */}
                <div className="flex items-center space-x-3 border-l border-border pl-6">
                  <div className="flex items-center space-x-2">
                    <FaUser className="text-text-secondary" />
                    <span className="text-sm font-medium text-text-primary" data-testid="navbar-username">
                      {session.user?.username}
                      {session.user?.role === "admin" && (
                        <span className="ml-2 text-xs bg-info-light text-info px-2 py-1 rounded font-semibold">
                          {t("admin")}
                        </span>
                      )}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 px-3 py-1 text-sm"
                  >
                    <FaSignOutAlt />
                    <span>{t("logout")}</span>
                  </Button>
                </div>
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
