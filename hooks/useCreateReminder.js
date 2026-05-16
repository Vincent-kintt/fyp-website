"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

export async function createReminderRequest(data) {
  const res = await fetch("/api/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReminderRequest,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}
