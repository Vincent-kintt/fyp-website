"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FaStickyNote, FaPlus } from "react-icons/fa";

export default function NotesPage() {
  const t = useTranslations("notes");
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          router.replace(`/notes/${data.data[0].id}`);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="skeleton-line w-48 h-6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <FaStickyNote className="w-12 h-12" style={{ color: "var(--text-muted)" }} />
      <p style={{ color: "var(--text-muted)" }} className="text-base">
        {t("emptyState")}
      </p>
      <button
        onClick={async () => {
          const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: t("untitled") }),
          });
          const data = await res.json();
          if (data.success) {
            router.push(`/notes/${data.data.id}`);
          }
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: "var(--primary)", color: "var(--text-inverted)" }}
      >
        <FaPlus className="w-3 h-3" />
        {t("emptyStateAction")}
      </button>
    </div>
  );
}
