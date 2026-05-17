"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// The inbox note is a per-user singleton; a fixed key (not parameterized by id)
// is sufficient because session boundaries already isolate caches.
const inboxNoteKey = ["inbox", "note"];

// /api/inbox/note uses POST as get-or-create (returns the singleton inbox note).
// Unusual semantically, but it is the current API contract.
export async function fetchInboxNoteRequest() {
  const res = await fetch("/api/inbox/note", { method: "POST" });
  if (!res.ok) throw new Error("Failed to load inbox note");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to load inbox note");
  return data.data;
}

export function inboxNoteQueryOptions() {
  return { queryKey: inboxNoteKey, queryFn: fetchInboxNoteRequest };
}

export function useInboxNote({ enabled = true, staleTime } = {}) {
  return useQuery({
    ...inboxNoteQueryOptions(),
    enabled,
    ...(staleTime !== undefined && { staleTime }),
  });
}

export async function updateInboxNoteRequest(patch) {
  const res = await fetch("/api/inbox/note", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update inbox note");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to update inbox note");
  return data.data;
}

export function useUpdateInboxNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateInboxNoteRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxNoteKey }),
  });
}
