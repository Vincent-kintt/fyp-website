"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
 * POST /api/notes/[id]/duplicate copies the source note and (if it has any)
 * its non-trashed, non-inbox descendants. Success toast text depends on the
 * `copiedCount` returned by the server.
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
      const count = data.data.copiedCount ?? 1;
      if (count > 1) {
        toast.success(t("notesDuplicatedCount", { count }));
      } else {
        toast.success(t("noteDuplicated"));
      }
      return data.data;
    }
    toast.error(t("saveFailed"));
  } catch {
    toast.error(t("saveFailed"));
  }
}

/**
 * POST /api/notes — create a new note under an optional parent.
 *
 * Optimistic insert is intentionally skipped: the new note's `id` is server-
 * derived and the caller immediately navigates to `/notes/[id]`, so a fake
 * placeholder id would need to be swapped post-response. Surfacing
 * `isCreating` from the wrapping useMutation is enough UX for the button
 * state.
 */
export async function executeCreateNote({
  parentId,
  fetch,
  queryClient,
  noteKeys,
  router,
  toast,
  t,
}) {
  try {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t("untitled"),
        parentId: parentId || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await queryClient.invalidateQueries({ queryKey: noteKeys.all });
      router.push(`/notes/${data.data.id}`);
      return data.data;
    }
    toast.error(t("saveFailed"));
  } catch {
    toast.error(t("saveFailed"));
  }
}

/**
 * PATCH /api/notes/[id] with a new title. Optimistically rewrites the cached
 * list so the sidebar title updates immediately. Rolls back on failure.
 */
export async function executeRenameNote({
  id,
  newTitle,
  fetch,
  queryClient,
  noteKeys,
  toast,
  t,
}) {
  await queryClient.cancelQueries({ queryKey: noteKeys.all });
  const previous = queryClient.getQueryData(noteKeys.lists());

  queryClient.setQueryData(noteKeys.lists(), (old) =>
    Array.isArray(old)
      ? old.map((n) => (n.id === id ? { ...n, title: newTitle } : n))
      : old,
  );

  try {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res?.ok) throw new Error("Failed");
  } catch {
    if (previous !== undefined) {
      queryClient.setQueryData(noteKeys.lists(), previous);
    }
    toast.error(t("saveFailed"));
  } finally {
    await queryClient.invalidateQueries({ queryKey: noteKeys.all });
  }
}

/**
 * DELETE /api/notes/[id] (soft delete to trash). Optimistically removes the
 * note from the active list. On success marks the deleted note's detail query
 * stale WITHOUT refetching it (refetchType:"none") so the still-mounted
 * detail observer doesn't fire a 404 refetch, then refreshes the list + trash
 * queries (the note moves from the list query to the trash query).
 *
 * Returns true on success so the caller can decide to navigate away from the
 * deleted note's page.
 */
export async function executeDeleteNote({
  id,
  fetch,
  queryClient,
  noteKeys,
  toast,
  t,
}) {
  await queryClient.cancelQueries({ queryKey: noteKeys.all });
  const previous = queryClient.getQueryData(noteKeys.lists());

  queryClient.setQueryData(noteKeys.lists(), (old) =>
    Array.isArray(old) ? old.filter((n) => n.id !== id) : old,
  );

  try {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res?.ok) throw new Error("Failed");
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed");
    // The deleted note's detail observer (useNote) is still mounted on the
    // page until router.replace unmounts it (App Router defers unmount into an
    // async transition). removeQueries here would re-create + refetch that
    // observer -> 404. Mark the detail stale WITHOUT refetching instead; a
    // later remount still refetches (-> 404 -> the page's noteError redirect).
    queryClient.invalidateQueries({
      queryKey: noteKeys.detail(id),
      refetchType: "none",
    });
    return true;
  } catch {
    if (previous !== undefined) {
      queryClient.setQueryData(noteKeys.lists(), previous);
    }
    toast.error(t("deleteFailed"));
    return false;
  } finally {
    // Refresh list + trash explicitly. NOT noteKeys.all: ["notes"] prefix-
    // matches noteKeys.detail(id) and (default refetchType:"active") would
    // refetch the still-mounted deleted-detail observer -> 404.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: noteKeys.trash() }),
    ]);
  }
}

/**
 * POST /api/notes/[id]/restore — move a trashed note back to the active list.
 * No optimistic update: the note is currently in the trash query and the
 * server response settles both queries via invalidation.
 */
export async function executeRestoreNote({
  id,
  fetch,
  queryClient,
  noteKeys,
  toast,
  t,
}) {
  try {
    const res = await fetch(`/api/notes/${id}/restore`, { method: "POST" });
    if (!res?.ok) throw new Error("Failed");
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed");
    await queryClient.invalidateQueries({ queryKey: noteKeys.all });
  } catch {
    toast.error(t("saveFailed"));
  }
}

/**
 * DELETE /api/notes/[id] from the trash (hard delete). Caller has already
 * confirmed; this path is irreversible. Drops the detail cache on success.
 */
export async function executePermanentDeleteNote({
  id,
  fetch,
  queryClient,
  noteKeys,
  toast,
  t,
}) {
  try {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res?.ok) throw new Error("Failed");
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed");
    await queryClient.invalidateQueries({ queryKey: noteKeys.all });
    removeNoteCaches({ queryClient, id });
  } catch {
    toast.error(t("deleteFailed"));
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
    queryKey: noteKeys.trash(),
    queryFn: fetchTrashedNotes,
    enabled: !!session,
  });

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
    [queryClient],
  );

  // ---- Create (no optimistic — server-derived id, then navigate) ----
  const createMutation = useMutation({
    mutationFn: (parentId) =>
      executeCreateNote({
        parentId,
        fetch,
        queryClient,
        noteKeys,
        router,
        toast,
        t,
      }),
  });

  // ---- Delete (optimistic removal + rollback + detail-cache drop) ----
  const deleteMutation = useMutation({
    mutationFn: (id) =>
      executeDeleteNote({
        id,
        fetch,
        queryClient,
        noteKeys,
        toast,
        t,
      }),
  });

  // ---- Rename (optimistic title update + rollback) ----
  const renameMutation = useMutation({
    mutationFn: ({ id, newTitle }) =>
      executeRenameNote({
        id,
        newTitle,
        fetch,
        queryClient,
        noteKeys,
        toast,
        t,
      }),
  });

  // ---- Duplicate (single-POST atomic copy; M2) ----
  const duplicateMutation = useMutation({
    mutationFn: (id) =>
      executeDuplicateNote({
        id,
        fetch,
        invalidateAll,
        router,
        toast,
        t,
      }),
  });

  // ---- Restore from trash (no optimistic — cross-query move) ----
  const restoreMutation = useMutation({
    mutationFn: (id) =>
      executeRestoreNote({
        id,
        fetch,
        queryClient,
        noteKeys,
        toast,
        t,
      }),
  });

  // ---- Permanent delete from trash ----
  const permanentDeleteMutation = useMutation({
    mutationFn: (id) =>
      executePermanentDeleteNote({
        id,
        fetch,
        queryClient,
        noteKeys,
        toast,
        t,
      }),
  });

  // ---- Reorder (optimistic batch + rollback) ----
  //
  // Kept inline as useMutation because the optimistic update is keyed off the
  // updates batch shape — not a single id — and the rollback path benefits
  // from React Query's onError context. The previous hand-rolled
  // implementation had the same semantics; this is a cleaner expression.
  const reorderMutation = useMutation({
    mutationFn: async (updates) => {
      const res = await fetch("/api/notes/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to reorder");
      }
      return res.json();
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.all });
      const previous = queryClient.getQueryData(noteKeys.lists());
      if (Array.isArray(previous)) {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        const optimistic = previous.map((note) => {
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
        queryClient.setQueryData(noteKeys.lists(), optimistic);
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(noteKeys.lists(), context.previous);
      }
      toast.error(t("saveFailed"));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: noteKeys.all }),
  });

  return {
    notes,
    trashedNotes,
    loading,
    // Action callers — keep the same signatures consumers already pass to
    // sidebar / PageTree / NoteTopBar so this refactor is additive.
    createNote: (parentId) => createMutation.mutateAsync(parentId),
    deleteNote: (id) => deleteMutation.mutateAsync(id),
    renameNote: (id, newTitle) =>
      renameMutation.mutateAsync({ id, newTitle }),
    duplicateNote: (id) => duplicateMutation.mutateAsync(id),
    restoreNote: (id) => restoreMutation.mutateAsync(id),
    permanentDeleteNote: (id) => permanentDeleteMutation.mutateAsync(id),
    reorderNotes: (updates) => reorderMutation.mutateAsync(updates),
    // Pending flags — UI can disable buttons during in-flight requests.
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRenaming: renameMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isPermanentDeleting: permanentDeleteMutation.isPending,
    isReordering: reorderMutation.isPending,
  };
}
