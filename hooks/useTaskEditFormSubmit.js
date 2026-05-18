"use client";

// Submit orchestration for TaskEditForm. Pattern mirrors executeDragEnd in
// hooks/useTaskDnD.js: the side-effecting body is a module-level async
// function with every dependency injected, and the hook is a thin
// useCallback wrapper that closes over the latest values.

import { useCallback, useState } from "react";
import { toast as defaultToast } from "sonner";
import { useTranslations } from "next-intl";
import { useUpdateReminder } from "@/hooks/useUpdateReminder";
import { useResolvedUserTimezone } from "@/hooks/useResolvedUserTimezone";
import { buildSubmitPayload } from "@/lib/forms/reminderSubmitPayload";

/**
 * Validate + build payload + mutate + toast + onSave. Pure async function;
 * no React access. Returns `{ ok, data?, error? }` so tests don't need to
 * inspect mock calls to know which branch executed.
 *
 * Inbox reminders (`reminder.inboxState === "inbox"`) may submit without a
 * dateTime — they live in the inbox bucket and acquire a datetime later.
 * Every other reminder requires a datetime.
 */
export async function executeSubmit({
  formData,
  reminder,
  userTimezone,
  updateMutation,
  t,
  toast,
  onSave,
  setError,
  setIsSubmitting,
}) {
  if (!formData.title.trim()) {
    setError(t("titleRequired"));
    return { ok: false, reason: "titleRequired" };
  }
  if (!formData.dateTime && reminder?.inboxState !== "inbox") {
    setError(t("dateRequired"));
    return { ok: false, reason: "dateRequired" };
  }

  try {
    setIsSubmitting(true);
    setError("");

    const submitData = buildSubmitPayload({ formData, userTimezone });

    const updated = await updateMutation.mutateAsync({
      id: reminder.id,
      ...submitData,
    });
    // The server response is the canonical post-PUT reminder including any
    // backend-derived fields (category/status/completed/inboxState); callers
    // get the full record rather than a locally merged shape.
    onSave(updated);
    return { ok: true, data: updated };
  } catch (err) {
    console.error("Error updating reminder:", err);
    toast.error(err?.message || t("updateFailed"));
    return { ok: false, error: err };
  } finally {
    setIsSubmitting(false);
  }
}

export function useTaskEditFormSubmit({ reminder, formData, setError, onSave }) {
  const t = useTranslations("editForm");
  const updateMutation = useUpdateReminder();
  const userTimezone = useResolvedUserTimezone();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      await executeSubmit({
        formData,
        reminder,
        userTimezone,
        updateMutation,
        t,
        toast: defaultToast,
        onSave,
        setError,
        setIsSubmitting,
      });
    },
    [formData, reminder, userTimezone, updateMutation, t, onSave, setError],
  );

  return { handleSubmit, isSubmitting };
}
