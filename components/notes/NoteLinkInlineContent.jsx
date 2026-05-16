"use client";

import { createReactInlineContentSpec } from "@blocknote/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { File } from "lucide-react";
import { useNoteList } from "@/hooks/useNoteList";
import NoteIcon from "./NoteIcon";

function NoteLinkChip({ noteId }) {
  const t = useTranslations("notes");
  const router = useRouter();
  const { data: notes = [], isLoading } = useNoteList();

  const note = notes.find((n) => n.id === noteId);

  if (isLoading) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
        style={{
          background: "var(--surface-hover)",
          color: "var(--text-muted)",
        }}
      >
        {t("noteLinkLoading")}
      </span>
    );
  }

  if (!note) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
        style={{
          background: "var(--surface-hover)",
          color: "var(--text-muted)",
          textDecoration: "line-through",
        }}
      >
        <File size={11} strokeWidth={1.5} style={{ opacity: 0.5 }} />
        {t("noteLinkDeleted")}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors"
      style={{
        background: "var(--surface-hover)",
        color: "var(--accent)",
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/notes/${noteId}`);
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.textDecoration = "underline")
      }
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/notes/${noteId}`);
      }}
    >
      <NoteIcon
        icon={note.icon}
        hasChildren={false}
        expanded={false}
        size={11}
      />
      {note.title || t("untitled")}
    </span>
  );
}

export const noteLinkSpec = createReactInlineContentSpec(
  {
    type: "noteLink",
    propSchema: {
      noteId: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => (
      <NoteLinkChip noteId={props.inlineContent.props.noteId} />
    ),
  },
);
