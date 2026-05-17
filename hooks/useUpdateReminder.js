"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

export async function updateReminderRequest({ id, ...patch }) {
  const res = await fetch(`/api/reminders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update reminder");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to update reminder");
  return data.data;
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateReminderRequest,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}
