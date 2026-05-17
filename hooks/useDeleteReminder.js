"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

export async function deleteReminderRequest(id) {
  const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete reminder");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to delete reminder");
  return data;
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteReminderRequest,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      queryClient.removeQueries({ queryKey: reminderKeys.detail(id) });
    },
  });
}
