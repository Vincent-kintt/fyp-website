// Bulk-wake snoozed reminders whose `snoozedUntil` cutoff has passed.
//
// The base predicate (`status: 'snoozed'`, `snoozedUntil: { $lte: now }`) is the
// authoritative filter — the caller's filter is spread FIRST so the base
// predicate always overwrites it. This is what makes the helper safe to share
// between the user-scoped endpoint (filter by userId) and the cron job (no
// filter): callers cannot accidentally widen the predicate to wake pending
// tasks or tasks that aren't due yet.

export async function wakeSnoozedTasks({
  collection,
  filter = {},
  now = new Date(),
}) {
  const mergedFilter = {
    ...filter,
    status: "snoozed",
    snoozedUntil: { $lte: now },
  };
  const result = await collection.updateMany(mergedFilter, {
    $set: {
      status: "pending",
      completed: false,
      snoozedUntil: null,
      updatedAt: now,
    },
  });
  return {
    reactivated: result.modifiedCount,
    timestamp: now.toISOString(),
  };
}
