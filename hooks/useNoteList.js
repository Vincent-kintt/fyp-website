"use client";

import { useQuery } from "@tanstack/react-query";
import { noteKeys } from "@/lib/queryKeys";

export async function fetchNoteList() {
  const res = await fetch("/api/notes");
  if (!res.ok) throw new Error("Failed to fetch notes");
  const data = await res.json();
  return data.data || [];
}

export function noteListQueryOptions() {
  return {
    queryKey: noteKeys.lists(),
    queryFn: fetchNoteList,
  };
}

export function useNoteList({ enabled = true, staleTime } = {}) {
  return useQuery({
    ...noteListQueryOptions(),
    enabled,
    ...(staleTime !== undefined && { staleTime }),
  });
}
