import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-text-muted mb-4">404</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">{t("notFoundTitle")}</h2>
        <p className="text-text-secondary mb-6">{t("notFoundDesc")}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center py-2 px-6 rounded-lg font-medium bg-primary text-text-inverted hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t("backToHome")}
        </Link>
      </div>
    </div>
  );
}
