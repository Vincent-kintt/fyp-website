"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { FaBell, FaUser, FaSignOutAlt, FaMoon, FaSun } from "react-icons/fa";
import { useEffect, useState } from "react";
import Button from "../ui/Button";

export default function Navbar() {
  const { data: session, status } = useSession();
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Get current theme, accounting for system preference
  const currentTheme = theme === "system" ? systemTheme : theme;

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <FaBell className="text-blue-600 dark:text-blue-400 text-2xl" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">ReminderApp</span>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <FaBell className="text-blue-600 dark:text-blue-400 text-2xl" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">ReminderApp</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link
              href="/"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
            >
              Home
            </Link>

            {session ? (
              <>
                <Link
                  href="/reminders"
                  className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
                >
                  Reminders
                </Link>

                {/* User Info */}
                <div className="flex items-center space-x-3 border-l border-gray-300 dark:border-gray-600 pl-6">
                  <div className="flex items-center space-x-2">
                    <FaUser className="text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {session.user?.username}
                      {session.user?.role === "admin" && (
                        <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded font-semibold">
                          Admin
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
                    <span>Logout</span>
                  </Button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Login
              </Link>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-yellow-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle theme"
            >
              {currentTheme === "dark" ? (
                <FaSun className="text-lg" />
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
