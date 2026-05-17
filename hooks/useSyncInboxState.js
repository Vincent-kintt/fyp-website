"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export async function syncInboxStateRequest({ extractedTasks, confirmedTasks }) {
  const res = await fetch("/api/inbox/note", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extractedTasks, confirmedTasks }),
  });
  if (!res.ok) throw new Error("Failed to sync inbox state");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to sync inbox state");
  return data.data;
}

// Use-case hook: callers fire-and-forget mutate(...) (intentional UX —
// extraction state is best-effort) so toast lives inside onError to keep
// failures visible. retry:false avoids stale retries clobbering a newer
// extraction snapshot.
export function useSyncInboxState() {
  const t = useTranslations("inbox");
  return useMutation({
    mutationFn: syncInboxStateRequest,
    retry: false,
    onError: () => toast.error(t("syncFailed")),
  });
}
