/**
 * Reset the inbox: clear the editor content + extracted tasks + confirmed
 * history, optimistically, then PATCH and roll everything back on failure.
 *
 * Same DI shape as `executeDeleteTask` (hooks/useTasks.js) and `executeDragEnd`
 * (hooks/useTaskDnD.js) — pure async function so it can be tested without
 * rendering React. The page-level useCallback is a thin wrapper that supplies
 * the live state references.
 *
 * Why a full rollback instead of a swallowed catch: the previous code cleared
 * local state + cache + remounted the editor optimistically, and the catch
 * block admitted "surfaces nowhere today". A failed PATCH then left the user
 * looking at an empty inbox while the server still held the old content —
 * the next refetch made the content reappear "from nowhere". M1 fixes this
 * with the canonical React Query rollback pattern.
 *
 * Why bump editorKey twice on failure: `NoteEditor` is mounted with
 * `key={`${inboxNote.id}-${editorKey}`}` in the inbox page. Setting the cache
 * back to the snapshot is not enough — the BlockNote editor only re-reads
 * its initial content on mount. The second bump forces the remount that
 * carries the restored content back into the DOM.
 */
export async function executeResetInbox({
  queryClient,
  updateMutation,
  setExtractedTasks,
  setConfirmedTasks,
  setEditorKey,
  toast,
  t,
  currentExtractedTasks,
  currentConfirmedTasks,
}) {
  const cacheKey = ["inbox", "note"];
  const cacheSnapshot = queryClient.getQueryData(cacheKey);

  setExtractedTasks([]);
  setConfirmedTasks([]);
  queryClient.setQueryData(cacheKey, (prev) =>
    prev ? { ...prev, content: [] } : prev,
  );
  setEditorKey((k) => k + 1);

  try {
    await updateMutation.mutateAsync({
      content: [],
      extractedTasks: [],
      confirmedTasks: [],
    });
  } catch {
    setExtractedTasks(currentExtractedTasks);
    setConfirmedTasks(currentConfirmedTasks);
    if (cacheSnapshot !== undefined) {
      queryClient.setQueryData(cacheKey, cacheSnapshot);
    }
    setEditorKey((k) => k + 1);
    toast.error(t("resetFailed"));
  }
}
