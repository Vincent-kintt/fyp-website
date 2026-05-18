"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { noteKeys } from "@/lib/queryKeys";
import { removeNoteCaches } from "@/lib/notes/cacheHelpers";
import { useNoteList } from "@/hooks/useNoteList";

async function fetchTrashedNotes() {
  const res = await fetch("/api/notes/trash");
  if (!res.ok) throw new Error("Failed to fetch trashed notes");
  const data = await res.json();
  return data.data || [];
}

/**
 * Pure helper composing the single-round-trip duplicate flow. The server-side
 * POST /api/notes/[id]/duplicate performs the entire copy atomically — no
 * compensating mutation is needed because the operation either commits one
 * document or no document.
 *
 * Exported for unit testing without rendering React.
 */
export async function executeDuplicateNote({
  id,
  fetch,
  invalidateAll,
  router,
  toast,
  t,
}) {
  try {
    const res = await fetch(`/api/notes/${id}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      await invalidateAll();
      router.push(`/notes/${data.data.id}`);
      return data.data;
    }
    toast.error(t("saveFailed"));
  } catch {
    toast.error(t("saveFailed"));
  }
}

export default function useNotes() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const t = useTranslations("notes");
  const router = useRouter();

  const { data: notes = [], isLoading: loading } = useNoteList({
    enabled: !!session,
  });

  const { data: trashedNotes = [] } = useQuery({
    queryKey: [...noteKeys.all, "trash"],
    queryFn: fetchTrashedNotes,
    enabled: !!session,
  });

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
    [queryClient],
  );

  const createNote = useCallback(
    async (parentId) => {
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t("untitled"), parentId: parentId || null }),
        });
        const data = await res.json();
        if (data.success) {
          await invalidateAll();
          router.push(`/notes/${data.data.id}`);
          return data.data;
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, router, t],
  );

  const deleteNote = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await invalidateAll();
          removeNoteCaches({ queryClient, id });
          return true;
        }
        return false;
      } catch {
        toast.error(t("deleteFailed"));
        return false;
      }
    },
    [invalidateAll, queryClient, t],
  );

  const renameNote = useCallback(
    async (id, newTitle) => {
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        const data = await res.json();
        if (data.success) await invalidateAll();
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, t],
  );

  const duplicateNote = useCallback(
    (id) =>
      executeDuplicateNote({
        id,
        fetch,
        invalidateAll,
        router,
        toast,
        t,
      }),
    [invalidateAll, router, t],
  );

  const reorderNotes = useCallback(
    async (updates) => {
      // Optimistic update: apply changes to cache immediately
      const previousNotes = queryClient.getQueryData(noteKeys.lists());

      if (previousNotes) {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        const optimisticNotes = previousNotes.map((note) => {
          const update = updateMap.get(note.id);
          if (update) {
            return {
              ...note,
              sortOrder: update.sortOrder,
              parentId: update.parentId ?? null,
            };
          }
          return note;
        });
        queryClient.setQueryData(noteKeys.lists(), optimisticNotes);
      }

      try {
        const res = await fetch("/api/notes/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to reorder");
        }
      } catch (err) {
        // Rollback on failure
        if (previousNotes) {
          queryClient.setQueryData(noteKeys.lists(), previousNotes);
        }
        toast.error(t("saveFailed"));
      } finally {
        await invalidateAll();
      }
    },
    [queryClient, invalidateAll, t],
  );

  const restoreNote = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}/restore`, { method: "POST" });
        const data = await res.json();
        if (data.success) await invalidateAll();
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [invalidateAll, t],
  );

  const permanentDeleteNote = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await invalidateAll();
          removeNoteCaches({ queryClient, id });
        }
      } catch {
        toast.error(t("deleteFailed"));
      }
    },
    [invalidateAll, queryClient, t],
  );

  return {
    notes,
    trashedNotes,
    loading,
    createNote,
    deleteNote,
    renameNote,
    duplicateNote,
    reorderNotes,
    restoreNote,
    permanentDeleteNote,
  };
}
