import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-auto">
      <div
        className="h-px mx-4 sm:mx-6 lg:mx-8"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--border) 50%, transparent)",
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-text-muted text-xs">
            © {new Date().getFullYear()} {t("copyright")}
          </p>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <Link
              href="/login"
              className="hover:text-primary transition-colors"
            >
              {t("login")}
            </Link>
            <span className="text-border">·</span>
            <Link
              href="#"
              className="hover:text-primary transition-colors"
            >
              {t("privacy")}
            </Link>
            <span className="text-border">·</span>
            <Link
              href="#"
              className="hover:text-primary transition-colors"
            >
              {t("terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
