// POST /api/notes/[noteId]/duplicate
//
// Server-side note duplication. Copies the source note and (if any) all of
// its non-trashed, non-inbox descendants. Best-effort `insertMany` with
// BFS ordering — partial-failure leaves a connected subtree from the new
// root, never orphan grandchildren. Industry pattern (Notion / Linear /
// ClickUp); see docs/superpowers/specs/2026-05-19-notes-subtree-duplicate-design.md.

import { ObjectId, BSON } from "mongodb";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { getNotesCollection, formatNote } from "@/lib/notes/db";
import { buildSubtreeCopyDocs } from "@/lib/notes/duplicateSubtreeBuilder.js";

const DOC_COUNT_CAP = 1000;
const BSON_SIZE_CAP_BYTES = 12 * 1024 * 1024;

export const POST = withAuth(
  async ({ params, userId }) => {
    const { noteId } = await params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const notesCollection = await getNotesCollection();
    const sourceObjectId = new ObjectId(noteId);

    const source = await notesCollection.findOne({
      _id: sourceObjectId,
      userId,
      deletedAt: null,
    });

    if (!source) {
      return apiError("Note not found", 404);
    }

    if (source.type === "inbox") {
      return apiError("Cannot duplicate inbox note", 403);
    }

    // Pull all descendants in one round-trip. restrictSearchWithMatch
    // prunes trashed / inbox / other-user nodes at every level of the
    // traversal — they never enter the frontier. No `maxDepth`: the doc
    // count cap below is the real bound.
    //
    // $graphLookup accumulates descendants into a single output document,
    // which is itself bounded by MongoDB's 16 MB BSON-doc limit. When the
    // accumulated descendants exceed that, the aggregation throws
    // BSONObjectTooLarge (code 10334) BEFORE we can read the result back to
    // JS and run the explicit BSON size cap below. Treat that error as the
    // same "too large to duplicate" condition the JS-side cap protects.
    let aggResult;
    try {
      aggResult = await notesCollection
        .aggregate(
          [
            { $match: { _id: sourceObjectId, userId } },
            {
              $graphLookup: {
                from: "notes",
                startWith: "$_id",
                connectFromField: "_id",
                connectToField: "parentId",
                as: "descendants",
                depthField: "depth",
                restrictSearchWithMatch: {
                  userId,
                  deletedAt: null,
                  type: { $ne: "inbox" },
                },
              },
            },
            { $project: { descendants: 1 } },
          ],
          { maxTimeMS: 5000 },
        )
        .toArray();
    } catch (err) {
      if (err?.code === 10334) {
        return apiError("Folder contents too large to duplicate", 413);
      }
      throw err;
    }

    const descendants = aggResult[0]?.descendants ?? [];

    // Caps. Doc count first (cheap), then BSON size estimate.
    if (descendants.length + 1 > DOC_COUNT_CAP) {
      return apiError(
        `Cannot duplicate more than ${DOC_COUNT_CAP} items at once`,
        413,
      );
    }
    const estimatedSize = BSON.calculateObjectSize({
      docs: [source, ...descendants],
    });
    if (estimatedSize > BSON_SIZE_CAP_BYTES) {
      return apiError("Folder contents too large to duplicate", 413);
    }

    // Slot the root copy between source and its next sibling, scoped to
    // (userId, parentId). Identical to the previous M2 logic.
    const sourceKey =
      typeof source.sortOrder === "string" ? source.sortOrder : null;
    const nextSibling = await notesCollection
      .find({
        userId,
        parentId: source.parentId ?? null,
        sortOrder: { $gt: sourceKey },
      })
      .sort({ sortOrder: 1, _id: 1 })
      .limit(1)
      .toArray();
    const nextSiblingSortOrder =
      typeof nextSibling[0]?.sortOrder === "string"
        ? nextSibling[0].sortOrder
        : null;

    const { rootCopyDoc, newDocs } = buildSubtreeCopyDocs({
      source,
      descendants,
      nextSiblingSortOrder,
    });

    try {
      await notesCollection.insertMany(newDocs, { ordered: true });
    } catch (err) {
      console.error("subtree duplicate insertMany failed:", err);
      return apiError("Failed to duplicate, please retry", 500);
    }

    return apiSuccess(
      { ...formatNote(rootCopyDoc), copiedCount: newDocs.length },
      201,
    );
  },
  {
    label: "POST /api/notes/[noteId]/duplicate",
    errorMessage: "Failed to duplicate, please retry",
  },
);
