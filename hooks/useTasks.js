"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { reminderKeys } from "@/lib/queryKeys";

async function fetchTasksFromApi() {
  const res = await fetch("/api/reminders");
  if (!res.ok) throw new Error("Failed to fetch tasks");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch tasks");
  return data.data;
}

export function useTasks() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const t = useTranslations("common");
  const wokenIdsRef = useRef(new Set());
  const deleteTimersRef = useRef(new Map());

  // ---- Query ----
  const query = useQuery({
    queryKey: reminderKeys.list({}),
    queryFn: fetchTasksFromApi,
    enabled: !!session,
  });

  // ---- Snooze-wake side effect ----
  useEffect(() => {
    if (!query.data) return;
    const now = new Date();
    query.data.forEach((task) => {
      if (
        task.status === "snoozed" &&
        task.snoozedUntil &&
        new Date(task.snoozedUntil) <= now &&
        !wokenIdsRef.current.has(task.id)
      ) {
        wokenIdsRef.current.add(task.id);
        fetch(`/api/reminders/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        }).catch(console.error);
        queryClient.setQueryData(reminderKeys.list({}), (old) =>
          old?.map((t) =>
            t.id === task.id
              ? { ...t, status: "pending", snoozedUntil: null }
              : t
          )
        );
      }
    });
  }, [query.data, queryClient]);

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

  // ---- Quick add (invalidate on success) ----
  const quickAddMutation = useMutation({
    mutationFn: (data) =>
      fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      toast.success(t("taskAdded"));
    },
    onError: () => toast.error(t("addFailed")),
  });

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
    quickAdd: (data) => quickAddMutation.mutate(data),
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  };
}
