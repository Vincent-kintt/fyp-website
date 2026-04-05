"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";

async function fetchInboxTasks() {
  const res = await fetch("/api/reminders?inboxState=inbox");
  if (!res.ok) throw new Error("Failed to fetch inbox tasks");
  const data = await res.json();
  return data.data || [];
}

export default function useInboxTasks() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: reminderKeys.list({ inboxState: "inbox" }),
    queryFn: fetchInboxTasks,
    enabled: !!session,
  });

  const addMutation = useMutation({
    mutationFn: async (taskData) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          tags: taskData.tags || [],
          priority: taskData.priority || "medium",
          dateTime: taskData.dateTime || null,
          inboxState: "inbox",
        }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });

  const addTask = useCallback(
    (taskData) => addMutation.mutateAsync(taskData),
    [addMutation],
  );

  const refetch = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: reminderKeys.list({ inboxState: "inbox" }),
      }),
    [queryClient],
  );

  return { tasks, loading, addTask, refetch };
}
