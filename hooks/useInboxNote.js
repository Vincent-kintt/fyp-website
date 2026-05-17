"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// The inbox note is a per-user singleton; a fixed key (not parameterized by id)
// is sufficient because session boundaries already isolate caches.
const inboxNoteKey = ["inbox", "note"];

// REST contract for /api/inbox/note:
//   GET   — read (404 if missing)
//   POST  — ensure (idempotent create); safe under the partial unique index
//   PATCH — update (strict 404 if missing)
//
// On first visit the inbox note may not exist yet, so we fall back: GET → if
// 404, POST to ensure, then re-GET. The POST response is intentionally not
// consumed — the second GET is the canonical read.
export async function fetchInboxNoteRequest() {
  let res = await fetch("/api/inbox/note");
  if (res.status === 404) {
    const ensureRes = await fetch("/api/inbox/note", { method: "POST" });
    if (!ensureRes.ok) throw new Error("Failed to create inbox note");
    res = await fetch("/api/inbox/note");
  }
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
