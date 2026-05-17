"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

export async function wakeSnoozedTasksRequest() {
  const res = await fetch("/api/reminders/wake-snoozed", { method: "POST" });
  if (!res.ok) throw new Error("Failed to wake snoozed tasks");
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to wake snoozed tasks");
  }
  return data.data;
}

export function useWakeSnoozedTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: wakeSnoozedTasksRequest,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.list({}) }),
  });
}
