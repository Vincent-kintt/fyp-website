"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { noteKeys } from "@/lib/queryKeys";

async function fetchNotes() {
  const res = await fetch("/api/notes");
  if (!res.ok) throw new Error("Failed to fetch notes");
  const data = await res.json();
  return data.data || [];
}

async function fetchTrashedNotes() {
  const res = await fetch("/api/notes/trash");
  if (!res.ok) throw new Error("Failed to fetch trashed notes");
  const data = await res.json();
  return data.data || [];
}

export default function useNotes() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const t = useTranslations("notes");
  const router = useRouter();

  const { data: notes = [], isLoading: loading } = useQuery({
    queryKey: noteKeys.lists(),
    queryFn: fetchNotes,
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
          return true;
        }
        return false;
      } catch {
        toast.error(t("deleteFailed"));
        return false;
      }
    },
    [invalidateAll, t],
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
    async (id) => {
      try {
        const getRes = await fetch(`/api/notes/${id}`);
        const getData = await getRes.json();
        if (!getData.success) return;
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${getData.data.title} (copy)`,
            parentId: getData.data.parentId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          await fetch(`/api/notes/${data.data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: getData.data.content }),
          });
          await invalidateAll();
          router.push(`/notes/${data.data.id}`);
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
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
        if (data.success) await invalidateAll();
      } catch {
        toast.error(t("deleteFailed"));
      }
    },
    [invalidateAll, t],
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
