import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
import { noteLinkSpec } from "../NoteLinkInlineContent";

export const noteEditorSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    noteLink: noteLinkSpec,
  },
});
