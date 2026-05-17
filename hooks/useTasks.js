"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { reminderKeys } from "@/lib/queryKeys";
import { fetchReminderList } from "@/hooks/useReminderList.js";
import { useCreateReminder } from "@/hooks/useCreateReminder.js";
import { useWakeSnoozedTasks } from "@/hooks/useWakeSnoozedTasks.js";

/**
 * Pure helper composing useCreateReminder + toast policy.
 * Exported for unit testing without rendering React.
 */
export async function executeQuickAdd({ data, createReminder, t, toast }) {
  try {
    const result = await createReminder.mutateAsync(data);
    toast.success(t("taskAdded"));
    return result;
  } catch (err) {
    toast.error(t("addFailed"));
    throw err;
  }
}

// Per-cutoff backoff window. The same earliest due cutoff will not retry the
// bulk-wake mutation within this many ms — prevents tight retry loops on POST
// failure and the post-invalidate refetch flap (cache update arrives, list
// briefly still shows snoozed-and-due rows, effect would otherwise refire).
export const WAKE_BACKOFF_MS = 30_000;

/**
 * Module-level dependency-injected helper that decides whether to fire the
 * bulk-wake mutation. Pure function over (tasks, mutate, isPending,
 * lastAttemptRef, now). Returns true iff `mutate` was called.
 *
 * Backoff key is the ISO string of the earliest due `snoozedUntil` — keying
 * off the due cutoff (not the call timestamp) means concurrent tabs sharing
 * the same view all settle on the same retry window.
 */
export function executeMaybeWakeSnoozed({
  tasks,
  mutate,
  isPending,
  lastAttemptRef,
  now,
}) {
  if (isPending) return false;
  if (!Array.isArray(tasks) || tasks.length === 0) return false;

  let earliestDue = null;
  for (const task of tasks) {
    if (task.status !== "snoozed" || !task.snoozedUntil) continue;
    const until = new Date(task.snoozedUntil);
    if (Number.isNaN(until.getTime())) continue;
    if (until > now) continue;
    if (!earliestDue || until < earliestDue) earliestDue = until;
  }
  if (!earliestDue) return false;

  const cutoffKey = earliestDue.toISOString();
  const lastAttempt = lastAttemptRef.current.get(cutoffKey);
  if (lastAttempt && now.getTime() - lastAttempt < WAKE_BACKOFF_MS) {
    return false;
  }
  lastAttemptRef.current.set(cutoffKey, now.getTime());

  mutate();
  return true;
}

export function useTasks() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const t = useTranslations("common");
  const lastAttemptRef = useRef(new Map());
  const deleteTimersRef = useRef(new Map());

  // ---- Query ----
  const query = useQuery({
    queryKey: reminderKeys.list({}),
    queryFn: fetchReminderList,
    enabled: !!session,
  });

  // ---- Snooze-wake side effect ----
  // Bulk-wake via /api/reminders/wake-snoozed instead of per-task PATCH +
  // optimistic cache rewrite. The server's `updateMany` is the source of
  // truth; React Query invalidation pulls the canonical list back.
  const wakeSnoozed = useWakeSnoozedTasks();
  useEffect(() => {
    executeMaybeWakeSnoozed({
      tasks: query.data,
      mutate: wakeSnoozed.mutate,
      isPending: wakeSnoozed.isPending,
      lastAttemptRef,
      now: new Date(),
    });
  }, [query.data, wakeSnoozed.mutate, wakeSnoozed.isPending]);

  // ---- Toggle complete (optimistic + undo toast) ----
  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }) =>
      fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: reminderKeys.all });
      const previous = queryClient.getQueryData(reminderKeys.list({}));
      queryClient.setQueryData(reminderKeys.list({}), (old) =>
        old?.map((t) =>
          t.id === id
            ? {
                ...t,
                completed,
                status: completed ? "completed" : "pending",
                completedAt: completed ? new Date().toISOString() : null,
                snoozedUntil: completed ? null : t.snoozedUntil,
              }
            : t
        )
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous)
        queryClient.setQueryData(reminderKeys.list({}), context.previous);
      toast.error(t("updateFailed"));
    },
    onSuccess: (_, { id, completed }) => {
      if (completed) {
        toast.success(t("completed"), {
          action: {
            label: t("undo"),
            onClick: () => toggleMutation.mutate({ id, completed: false }),
          },
          duration: 3000,
        });
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });

  // ---- Deferred delete (5s undo window, NOT a TQ mutation) ----
  const deleteTask = useCallback(
    (id) => {
      const previous = queryClient.getQueryData(reminderKeys.list({}));
      queryClient.setQueryData(reminderKeys.list({}), (old) =>
        old?.filter((t) => t.id !== id)
      );

      const timer = setTimeout(async () => {
        deleteTimersRef.current.delete(id);
        try {
          const res = await fetch(`/api/reminders/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed");
          queryClient.invalidateQueries({ queryKey: reminderKeys.all });
        } catch {
          queryClient.setQueryData(reminderKeys.list({}), previous);
          toast.error(t("deleteFailed"));
        }
      }, 5000);

      deleteTimersRef.current.set(id, timer);

      toast(t("deleted"), {
        action: {
          label: t("undo"),
          onClick: () => {
            clearTimeout(timer);
            deleteTimersRef.current.delete(id);
            queryClient.setQueryData(reminderKeys.list({}), previous);
          },
        },
        duration: 5000,
      });
    },
    [queryClient, t]
  );

  // ---- Update (no optimistic, invalidate on success) ----
  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }) =>
      fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
    onError: () => toast.error(t("updateFailed")),
  });

  // ---- Snooze / cancel snooze (optimistic) ----
  const snoozeMutation = useMutation({
    mutationFn: ({ id, snoozedUntil }) => {
      const body = snoozedUntil
        ? { status: "snoozed", snoozedUntil }
        : { status: "pending", snoozedUntil: null };
      return fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      });
    },
    onMutate: async ({ id, snoozedUntil }) => {
      await queryClient.cancelQueries({ queryKey: reminderKeys.all });
      const previous = queryClient.getQueryData(reminderKeys.list({}));
      queryClient.setQueryData(reminderKeys.list({}), (old) =>
        old?.map((t) =>
          t.id === id
            ? {
                ...t,
                status: snoozedUntil ? "snoozed" : "pending",
                snoozedUntil: snoozedUntil || null,
              }
            : t
        )
      );
      return { previous };
    },
    onError: (_, { snoozedUntil }, context) => {
      if (context?.previous)
        queryClient.setQueryData(reminderKeys.list({}), context.previous);
      toast.error(snoozedUntil ? t("snoozeFailed") : t("cancelSnoozeFailed"));
    },
    onSuccess: (_, { snoozedUntil }) => {
      toast.success(snoozedUntil ? t("snoozed") : t("snoozeCancelled"));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });

  // ---- Quick add — compose useCreateReminder with toast policy ----
  const createReminder = useCreateReminder();
  const quickAdd = useCallback(
    (data) => executeQuickAdd({ data, createReminder, t, toast }),
    [createReminder, t],
  );

  // ---- Cleanup delete timers on unmount ----
  useEffect(() => {
    const timers = deleteTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return {
    tasks: query.data ?? [],
    loading: query.isLoading,
    toggleComplete: (id, completed) =>
      toggleMutation.mutateAsync({ id, completed }),
    deleteTask,
    updateTask: (patch) => updateMutation.mutate(patch),
    snoozeTask: (id, snoozedUntil) =>
      snoozeMutation.mutate({ id, snoozedUntil }),
    quickAdd,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  };
}
