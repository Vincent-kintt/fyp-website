"use client";

import { useTranslations } from "next-intl";

export default function CommandBlock({ command, input }) {
  const t = useTranslations("notes");

  return (
    <div className="notes-command-block">
      <div className="command-label">{t("aiCommand")}</div>
      <div className="command-text">
        /{command} {input}
      </div>
    </div>
  );
}
