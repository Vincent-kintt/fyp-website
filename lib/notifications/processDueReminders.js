// Drive the cron/notify endpoint with lease + commit semantics.
//
// The original implementation atomically set `notificationSent: true` BEFORE
// looking up subscriptions or sending. That gave us three silent failure
// modes:
//
//   1. User had no subscriptions yet      → reminder permanently marked sent;
//                                            enabling push later did NOT
//                                            retro-deliver.
//   2. All subscriptions returned 410     → endpoints cleaned, but reminder
//                                            still claimed (nothing delivered).
//   3. Transient send error (500, etc.)   → claim sticks; next cron skips it.
//
// This module replaces "claim first" with "lease then commit":
//
//   - Acquire a short-lived lease (`notificationLeaseUntil`) via an atomic
//     findOneAndUpdate that re-checks eligibility. This blocks overlapping
//     cron invocations from double-processing the same reminder.
//   - Only set `notificationSent: true` after at least one push has actually
//     succeeded.
//   - "No subs" releases the lease without claiming — indefinite retry.
//   - "All gone (410/404)" releases the lease without claiming. No subs left
//     means nothing to deliver; we never had a chance to send.
//   - Transient failures release the lease so the next cron retries.
//
// PII: web-push libraries embed the endpoint URL in `error.message`. We log
// only the statusCode.

const DEFAULT_LEASE_MS = 5 * 60 * 1000; // 5 minutes — far longer than the
// cron handler's maxDuration (10s) so a crashed cron can't permanently park a
// reminder, but short enough that a retry happens within a few cron ticks.

export async function processDueReminders({
  remindersCollection,
  subscriptionsCollection,
  sendPush,
  now = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
  limit = 50,
}) {
  const leaseExpiry = new Date(now.getTime() + leaseMs);

  const dueQuery = {
    dateTime: { $lte: now },
    status: { $in: ["pending", "in_progress"] },
    notificationSent: { $ne: true },
    $or: [
      { notificationLeaseUntil: { $exists: false } },
      { notificationLeaseUntil: null },
      { notificationLeaseUntil: { $lt: now } },
    ],
  };

  const dueReminders = await remindersCollection
    .find(dueQuery)
    .limit(limit)
    .toArray();

  const counters = {
    processed: 0,
    sent: 0,
    failed: 0,
    cleaned: 0,
    no_subs: 0,
    all_gone: 0,
    partial_success: 0,
  };

  for (const reminder of dueReminders) {
    // Atomically acquire the lease. The second eligibility check on
    // `notificationSent` and `notificationLeaseUntil` is what makes this
    // safe against an overlapping cron — if another worker already took the
    // lease, findOneAndUpdate returns null and we skip this reminder.
    const acquired = await remindersCollection.findOneAndUpdate(
      {
        _id: reminder._id,
        notificationSent: { $ne: true },
        $or: [
          { notificationLeaseUntil: { $exists: false } },
          { notificationLeaseUntil: null },
          { notificationLeaseUntil: { $lt: now } },
        ],
      },
      { $set: { notificationLeaseUntil: leaseExpiry } },
    );
    if (!acquired) continue;
    counters.processed++;

    const subs = await subscriptionsCollection
      .find({ userId: reminder.userId })
      .toArray();

    if (subs.length === 0) {
      // Indefinite-retry case: a user may enable push later.
      counters.no_subs++;
      await remindersCollection.updateOne(
        { _id: reminder._id },
        { $set: { notificationLeaseUntil: null } },
      );
      continue;
    }

    const payload = {
      title: `Reminder: ${reminder.title}`,
      body: reminder.description
        ? reminder.description.slice(0, 200)
        : "Your reminder is due now",
      tag: reminder._id.toString(),
      url: `/reminders/${reminder._id.toString()}`,
      reminderId: reminder._id.toString(),
    };

    let anySucceeded = false;
    let anyGone = false;
    let anyTransient = false;
    let cleanedThisReminder = 0;

    for (const sub of subs) {
      const result = await sendPush(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
      );
      if (result.success) {
        counters.sent++;
        anySucceeded = true;
      } else if (result.statusCode === 410 || result.statusCode === 404) {
        await subscriptionsCollection.deleteOne({ _id: sub._id });
        counters.cleaned++;
        cleanedThisReminder++;
        anyGone = true;
      } else {
        counters.failed++;
        anyTransient = true;
        console.error(
          `[cron/notify] Push failed sub=${sub._id} status=${result.statusCode}`,
        );
      }
    }

    if (anySucceeded) {
      await remindersCollection.updateOne(
        { _id: reminder._id },
        {
          $set: {
            notificationSent: true,
            notifiedAt: now,
            notificationLeaseUntil: null,
          },
        },
      );
      if (anyGone || anyTransient) counters.partial_success++;
    } else if (cleanedThisReminder === subs.length) {
      counters.all_gone++;
      await remindersCollection.updateOne(
        { _id: reminder._id },
        { $set: { notificationLeaseUntil: null } },
      );
    } else {
      await remindersCollection.updateOne(
        { _id: reminder._id },
        { $set: { notificationLeaseUntil: null } },
      );
    }
  }

  return counters;
}
