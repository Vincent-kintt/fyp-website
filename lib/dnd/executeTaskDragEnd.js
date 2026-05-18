/**
 * executeTaskDragEnd — shared orchestration for task drag-end side effects.
 *
 * Both the dashboard's `executeDragEnd` and the calendar page need the same
 * underlying flow: snapshot the React-Query cache, apply an optimistic
 * update, fire the API call, rollback + error toast on failure, optional
 * success toast. They differ only in *how* the drop target maps to an
 * optimistic patch and which API to call — that's the caller's job.
 *
 * Two write modes:
 *   - `optimisticPatch`  — caller supplies a partial task object; this
 *                          helper merges it onto the matching task only.
 *   - `optimisticTasks`  — caller supplies the full replacement list
 *                          (e.g. within-section reorder with new sortOrders).
 *
 * Either mode rolls back to the snapshot identity on failure.
 *
 * @param {object} params
 * @param {string} params.activeId        - id of the dragged task
 * @param {Array}  params.tasks           - current task list
 * @param {object} params.queryClient     - React-Query client (getQueryData / setQueryData)
 * @param {object} [params.optimisticPatch] - partial task fields to merge over the dragged task
 * @param {Array}  [params.optimisticTasks] - full replacement list (mutually exclusive with optimisticPatch)
 * @param {() => Promise<any>} params.apiCall - closure that fires the actual PATCH / reorder call
 * @param {object} params.toast           - { error, success, warning } from sonner
 * @param {(key, params?) => string} params.t - i18n translator
 * @param {string} [params.successKey]    - i18n key for success toast; omit for silent success
 * @param {object} [params.successParams] - params passed to t(successKey, params)
 * @param {string} [params.errorKey]      - i18n key for error toast (default: "moveFailed")
 */
import { reminderKeys } from "@/lib/queryKeys.js";

export async function executeTaskDragEnd({
  activeId,
  tasks,
  queryClient,
  optimisticPatch,
  optimisticTasks,
  apiCall,
  toast,
  t,
  successKey,
  successParams,
  errorKey = "moveFailed",
}) {
  if (!activeId) return;
  const draggedTask = tasks.find((task) => task.id === activeId);
  if (!draggedTask) return;

  const queryKey = reminderKeys.list({});
  const snapshot = queryClient.getQueryData(queryKey);

  const nextList = optimisticTasks
    ? optimisticTasks
    : tasks.map((task) =>
        task.id === activeId ? { ...task, ...optimisticPatch } : task,
      );

  queryClient.setQueryData(queryKey, nextList);

  try {
    await apiCall();
    if (successKey) {
      toast.success(successParams ? t(successKey, successParams) : t(successKey));
    }
  } catch {
    queryClient.setQueryData(queryKey, snapshot);
    toast.error(t(errorKey));
  }
}
