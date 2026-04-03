"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FileText, Plus } from "lucide-react";

export default function NotesPage() {
  const t = useTranslations("notes");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        if (!mountedRef.current) return;
        if (data.success && data.data.length > 0) {
          router.replace(`/notes/${data.data[0].id}`);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="skeleton-line w-48 h-6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <FileText size={48} strokeWidth={1} style={{ color: "var(--text-muted)" }} />
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
        <Plus size={14} strokeWidth={1.5} />
        {t("emptyStateAction")}
      </button>
    </div>
  );
}
