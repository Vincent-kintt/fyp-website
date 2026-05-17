"use client";

import { useQuery } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

export async function fetchReminderRequest(id) {
  const res = await fetch(`/api/reminders/${id}`);
  if (!res.ok) throw new Error("Failed to fetch reminder");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch reminder");
  return data.data;
}

export function reminderQueryOptions(id) {
  return {
    queryKey: reminderKeys.detail(id),
    queryFn: () => fetchReminderRequest(id),
  };
}

export function useReminder({ id, enabled = true, staleTime } = {}) {
  return useQuery({
    ...reminderQueryOptions(id),
    enabled: enabled && !!id,
    ...(staleTime !== undefined && { staleTime }),
  });
}
