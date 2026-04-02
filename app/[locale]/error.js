"use client";

import { useTranslations } from "next-intl";

export default function Error({ error, reset }) {
  const t = useTranslations("errors");
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-danger-light flex items-center justify-center">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">{t("somethingWrong")}</h2>
        <p className="text-text-secondary mb-6">{t("unexpectedError")}</p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center py-2 px-6 rounded-lg font-medium bg-primary text-text-inverted hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t("tryAgain")}
        </button>
      </div>
    </div>
  );
}
