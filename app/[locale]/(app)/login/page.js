"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { FaBell } from "react-icons/fa";
import ErrorState from "@/components/ui/ErrorState";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("login");
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
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
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

        {/* Registration success message */}
        {searchParams.get("registered") === "true" && (
          <div className="bg-success-light border border-success/30 text-success px-4 py-3 rounded-lg text-sm">
            {t("registrationSuccess")}
          </div>
        )}

        {/* Login Form */}
        <form data-testid="login-form" className="mt-8 space-y-6 bg-surface border border-border p-8 rounded-lg shadow-lg" onSubmit={handleSubmit}>
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
            label={t("password")}
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={t("passwordPlaceholder")}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isLoading}
          >
            {t("signIn")}
          </Button>

          <p className="text-center text-sm text-text-muted">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              {t("signUp")}
            </Link>
          </p>

          {/* Demo Accounts Info */}
          <div className="mt-6 p-4 bg-info-light border border-info/30 rounded">
            <p className="text-sm font-semibold text-info mb-2">{t("demoTitle")}</p>
            <div className="text-sm text-info/80 space-y-1">
              <p>{t("demoAdmin", { username: "admin", password: "admin" })}</p>
              <p>{t("demoUser", { username: "user", password: "user" })}</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
