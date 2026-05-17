"use client";

import { useQuery } from "@tanstack/react-query";
import { noteKeys } from "@/lib/queryKeys";

export async function fetchNoteRequest(id) {
  const res = await fetch(`/api/notes/${id}`);
  if (!res.ok) throw new Error("Failed to fetch note");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch note");
  return data.data;
}

export function noteQueryOptions(id) {
  return {
    queryKey: noteKeys.detail(id),
    queryFn: () => fetchNoteRequest(id),
  };
}

export function useNote({ id, enabled = true, staleTime } = {}) {
  return useQuery({
    ...noteQueryOptions(id),
    enabled: enabled && !!id,
    ...(staleTime !== undefined && { staleTime }),
  });
}
