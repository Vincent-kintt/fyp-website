"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { FaBell } from "react-icons/fa";
import ErrorState from "@/components/ui/ErrorState";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("register");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
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

    // Client-side validation
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(formData.username)) {
      setError(t("errorUsername"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t("errorEmail"));
      return;
    }

    if (formData.password.length < 8) {
      setError(t("errorPasswordLength"));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t("errorPasswordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errorGeneric"));
        setIsLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError(t("errorGeneric"));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary-light)_0%,transparent_70%)] opacity-40 pointer-events-none" />
      <div className="max-w-md w-full space-y-8 relative">
        {/* Logo */}
        <div className="text-center">
          <FaBell className="mx-auto text-primary text-6xl mb-4" />
          <h2 className="text-3xl font-bold text-text-primary">{t("title")}</h2>
          <p className="mt-2 text-sm text-text-muted">
            {t("subtitle")}
          </p>
        </div>

        {/* Register Form */}
        <form
          data-testid="register-form"
          className="mt-8 space-y-6 bg-surface border border-border p-8 rounded-lg shadow-lg"
          onSubmit={handleSubmit}
        >
          {error && <ErrorState message={error} />}

          <Input
            label={t("username")}
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder={t("usernamePlaceholder")}
            required
          />

          <Input
            label={t("email")}
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder={t("emailPlaceholder")}
            required
          />

          <Input
            label={t("password")}
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={t("passwordPlaceholder")}
            required
          />

          <Input
            label={t("confirmPassword")}
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder={t("confirmPasswordPlaceholder")}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isLoading}
          >
            {t("createAccount")}
          </Button>

          <p className="text-center text-sm text-text-muted">
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              {t("signIn")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
