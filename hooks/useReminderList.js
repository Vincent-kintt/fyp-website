"use client";

import { useQuery } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

export async function fetchReminderList() {
  const res = await fetch("/api/reminders");
  if (!res.ok) throw new Error("Failed to fetch reminders");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch reminders");
  return data.data;
}

export function reminderListQueryOptions() {
  return {
    queryKey: reminderKeys.list({}),
    queryFn: fetchReminderList,
  };
}

export function useReminderList({ enabled = true, staleTime } = {}) {
  return useQuery({
    ...reminderListQueryOptions(),
    enabled,
    ...(staleTime !== undefined && { staleTime }),
  });
}
