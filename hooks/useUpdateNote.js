"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { noteKeys } from "@/lib/queryKeys";

export async function updateNoteRequest({ id, ...patch }) {
  const res = await fetch(`/api/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update note");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to update note");
  return data.data;
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNoteRequest,
    onSuccess: () =>
      // noteKeys.all is a prefix; invalidating it cascades to both
      // noteKeys.lists() and noteKeys.detail(id).
      queryClient.invalidateQueries({ queryKey: noteKeys.all }),
  });
}
