"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { FaBell } from "react-icons/fa";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username: formData.username,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else if (result?.ok) {
        router.push("/reminders");
        router.refresh();
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <FaBell className="mx-auto text-blue-600 dark:text-blue-400 text-6xl mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">ReminderApp</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Input
            label="Username"
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Enter your username"
            required
          />

          <Input
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>

          {/* Demo Accounts Info */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Demo Accounts:</p>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p>👤 Admin: username: <code className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded">admin</code> / password: <code className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded">admin</code></p>
              <p>👤 User: username: <code className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded">user</code> / password: <code className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded">user</code></p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
