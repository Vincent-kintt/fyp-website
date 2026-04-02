"use client";

import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ResponseBlock({ content, loading }) {
  const t = useTranslations("notes");

  return (
    <div className="notes-response-block">
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton-line h-3 w-3/4" />
          <div className="skeleton-line h-3 w-1/2" />
          <div className="skeleton-line h-3 w-5/6" />
        </div>
      ) : (
        <>
          <div
            className="markdown-content text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
          <div className="response-label">{t("aiGenerated")}</div>
        </>
      )}
    </div>
  );
}
