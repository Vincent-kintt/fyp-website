"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { File, RotateCcw, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function TrashSection({
  trashedNotes,
  onRestore,
  onPermanentDelete,
}) {
  const t = useTranslations("notes");
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (!trashedNotes || trashedNotes.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("trashEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div className="notes-trash-section py-1">
      {trashedNotes.map((note) => (
        <div key={note.id} className="notes-trash-item">
          <File
            size={14}
            strokeWidth={1.5}
            style={{ opacity: 0.5, flexShrink: 0 }}
          />
          <span className="flex-1 truncate text-[13px]">
            {note.title || t("untitled")}
          </span>
          <div className="trash-actions">
            <button
              onClick={() => onRestore?.(note.id)}
              title={t("restore")}
              aria-label={t("restore")}
            >
              <RotateCcw size={13} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setDeleteTarget(note.id)}
              title={t("deletePermanently")}
              aria-label={t("deletePermanently")}
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          onPermanentDelete?.(deleteTarget);
          setDeleteTarget(null);
        }}
        title={t("confirmPermanentDeleteTitle")}
        message={t("confirmPermanentDelete")}
        confirmLabel={t("deletePermanently")}
        variant="danger"
      />
    </div>
  );
}
