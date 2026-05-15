import NoteIcon from "../../NoteIcon";

export function getMentionItems({ notes, t, editorInstance }) {
  if (!notes || notes.length === 0) return [];
  return notes.map((n) => ({
    title: n.title || t("untitled"),
    onItemClick: () => {
      editorInstance.insertInlineContent([
        { type: "noteLink", props: { noteId: n.id } },
        " ",
      ]);
    },
    icon: (
      <NoteIcon
        icon={n.icon}
        hasChildren={false}
        expanded={false}
        size={14}
      />
    ),
    aliases: [],
    group: t("mentionNotes"),
  }));
}
