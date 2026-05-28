import { noteKeys } from "@/lib/queryKeys";

/**
 * Remove the detail cache for a note. Use after a PERMANENT delete
 * so the next mount of useNote(id) refetches instead of serving a stale
 * detail (the note no longer exists, so the cache must be GONE — not just
 * marked stale).
 *
 * List caches are intentionally NOT touched here: callers already
 * invalidateQueries({ queryKey: noteKeys.all }) which cascades to list
 * subtrees.
 */
export function removeNoteCaches({ queryClient, id }) {
  queryClient.removeQueries({ queryKey: noteKeys.detail(id) });
}
