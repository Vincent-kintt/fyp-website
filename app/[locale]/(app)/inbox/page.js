"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderKeys } from "@/lib/queryKeys";
import { blocksToText } from "@/lib/notes/blocksToText";

import NoteEditor from "@/components/notes/NoteEditor";
import InboxTopBar from "@/components/inbox/InboxTopBar";
import ExtractedTasksSection from "@/components/inbox/ExtractedTasksSection";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("inbox");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [inboxNote, setInboxNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const editorRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Fetch or create inbox note
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const res = await fetch("/api/inbox/note", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          setInboxNote(data.data);
        }
      } catch (err) {
        console.error("Failed to load inbox note:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user]);

  // Save handler for NoteEditor
  const handleSave = useCallback(async (updates) => {
    try {
      const res = await fetch("/api/inbox/note", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!data.success) throw new Error("Save failed");
    } catch (err) {
      throw err;
    }
  }, []);

  // Extract tasks from editor content
  const handleExtract = useCallback(async () => {
    const blocks = editorRef.current?.getContent();
    if (!blocks) return;

    const text = blocksToText(blocks);
    if (!text.trim()) {
      toast.info(t("noTasks"));
      return;
    }

    // Warn if there are unconfirmed tasks
    if (extractedTasks.length > 0) {
      toast.info(t("reExtractWarning"));
    }

    setIsExtracting(true);
    try {
      const res = await fetch("/api/ai/extract-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: locale === "zh-TW" ? "zh" : "en",
        }),
      });
      const data = await res.json();
      if (data.success && data.data.tasks.length > 0) {
        setExtractedTasks(data.data.tasks);
      } else {
        setExtractedTasks([]);
        toast.info(t("noTasks"));
      }
    } catch {
      toast.error("Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  }, [extractedTasks.length, locale, t]);

  // Confirm a single task → create reminder
  const handleConfirm = useCallback(
    async (task) => {
      try {
        const hasDate = !!task.dateTime;
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            dateTime: task.dateTime || null,
            priority: task.priority || "medium",
            tags: task.tags || [],
            inboxState: hasDate ? "processed" : "inbox",
          }),
        });
        if (!res.ok) throw new Error("Failed");
        setExtractedTasks((prev) => prev.filter((t) => t !== task));
        queryClient.invalidateQueries({ queryKey: reminderKeys.all });
        toast.success(t("confirmed"));
      } catch {
        toast.error(t("confirmFailed"));
      }
    },
    [queryClient, t],
  );

  // Confirm all tasks
  const handleConfirmAll = useCallback(async () => {
    let success = 0;
    let failed = 0;
    const remaining = [...extractedTasks];

    for (const task of extractedTasks) {
      try {
        const hasDate = !!task.dateTime;
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            dateTime: task.dateTime || null,
            priority: task.priority || "medium",
            tags: task.tags || [],
            inboxState: hasDate ? "processed" : "inbox",
          }),
        });
        if (!res.ok) throw new Error("Failed");
        success++;
        const idx = remaining.indexOf(task);
        if (idx !== -1) remaining.splice(idx, 1);
      } catch {
        failed++;
      }
    }

    setExtractedTasks(remaining);
    queryClient.invalidateQueries({ queryKey: reminderKeys.all });

    if (failed === 0) {
      toast.success(t("confirmed"));
    } else {
      toast.error(t("partialSuccess", { success, failed }));
    }
  }, [extractedTasks, queryClient, t]);

  // Dismiss a task
  const handleDismiss = useCallback(
    (task) => {
      setExtractedTasks((prev) => prev.filter((t) => t !== task));
      toast(t("dismissed"));
    },
    [t],
  );

  if (status === "loading" || loading) {
    return (
      <div className="flex h-full">
        <section
          className="flex-1 overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-between px-3"
            style={{
              minHeight: 40,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="skeleton-line h-3 w-24" />
            <div className="skeleton-line h-3 w-20" />
          </div>
          <div className="px-6 pt-6">
            <div className="space-y-3" style={{ paddingLeft: 54 }}>
              <div className="skeleton-line h-4 w-full" />
              <div className="skeleton-line h-4 w-5/6" />
              <div className="skeleton-line h-4 w-3/5" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>
      <InboxTopBar
        saveStatus={saveStatus}
        onExtract={handleExtract}
        isExtracting={isExtracting}
      />

      <div className="flex-1 overflow-y-auto">
        {inboxNote && (
          <NoteEditor
            key={inboxNote.id}
            note={inboxNote}
            onSave={handleSave}
            onSaveStatusChange={setSaveStatus}
            hideTitle
            editorRef={editorRef}
          />
        )}

        <ExtractedTasksSection
          tasks={extractedTasks}
          onConfirm={handleConfirm}
          onConfirmAll={handleConfirmAll}
          onDismiss={handleDismiss}
        />
      </div>
    </div>
  );
}
