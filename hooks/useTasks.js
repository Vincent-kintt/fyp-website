"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

const TASKS_KEY = ["tasks"];

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
  const wokenIdsRef = useRef(new Set());
  const deleteTimersRef = useRef(new Map());

  // ---- Query ----
  const query = useQuery({
    queryKey: TASKS_KEY,
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
        queryClient.setQueryData(TASKS_KEY, (old) =>
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
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData(TASKS_KEY);
      queryClient.setQueryData(TASKS_KEY, (old) =>
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
        queryClient.setQueryData(TASKS_KEY, context.previous);
      toast.error("更新失敗");
    },
    onSuccess: (_, { id, completed }) => {
      if (completed) {
        toast.success("已完成", {
          action: {
            label: "撤銷",
            onClick: () => toggleMutation.mutate({ id, completed: false }),
          },
          duration: 3000,
        });
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });

  // ---- Deferred delete (5s undo window, NOT a TQ mutation) ----
  const deleteTask = useCallback(
    (id) => {
      const previous = queryClient.getQueryData(TASKS_KEY);
      queryClient.setQueryData(TASKS_KEY, (old) =>
        old?.filter((t) => t.id !== id)
      );

      const timer = setTimeout(async () => {
        deleteTimersRef.current.delete(id);
        try {
          const res = await fetch(`/api/reminders/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed");
          queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        } catch {
          queryClient.setQueryData(TASKS_KEY, previous);
          toast.error("刪除失敗");
        }
      }, 5000);

      deleteTimersRef.current.set(id, timer);

      toast("已刪除", {
        action: {
          label: "撤銷",
          onClick: () => {
            clearTimeout(timer);
            deleteTimersRef.current.delete(id);
            queryClient.setQueryData(TASKS_KEY, previous);
          },
        },
        duration: 5000,
      });
    },
    [queryClient]
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
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
    onError: () => toast.error("更新失敗"),
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
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData(TASKS_KEY);
      queryClient.setQueryData(TASKS_KEY, (old) =>
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
        queryClient.setQueryData(TASKS_KEY, context.previous);
      toast.error(snoozedUntil ? "延後失敗" : "取消延後失敗");
    },
    onSuccess: (_, { snoozedUntil }) => {
      toast.success(snoozedUntil ? "已延後提醒" : "已取消延後");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
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
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      toast.success("Task added");
    },
    onError: () => toast.error("新增失敗"),
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
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  };
}
