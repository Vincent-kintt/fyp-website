// Drive the cron/notify endpoint with atomic-claim + in-loop 5xx retry.
//
// Per RFC 8030 / FCM / APNs official guidance: the push service holds the
// message for up to TTL seconds and retries delivery to offline devices
// itself. App-level retro-delivery across crons duplicates work the
// transport already does and produces stale notifications that are bad UX
// (see Netguru, "Why Mobile Push Notification Architecture Fails").
//
// So the helper is fire-and-forget per cron tick:
//   1. Atomically claim the reminder via findOneAndUpdate that sets
//      `notificationSent: true`. The eligibility filter (`$ne: true`) makes
//      this safe against overlapping cron ticks — only one worker wins the
//      claim and proceeds.
//   2. Look up subscriptions. No subs? Still claimed; we don't retro-deliver.
//   3. For each subscription, send with in-loop exponential backoff for
//      transient codes (5xx / 429). Terminal codes (410/404/400/403)
//      short-circuit the retry; 410/404 additionally delete the stale sub.
//
// PII: web-push libraries embed the endpoint URL in `error.message`. We log
// only sub._id, statusCode and attempts.

const DEFAULT_SEND_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 500;

/**
 * Retry semantics:
 *   sendRetries = N total attempts (default 3).
 *   Between attempts: exp backoff = backoffMs * 2^(attempt-1).
 *   So 3 attempts → backoffs of 500ms, 1000ms (no backoff after final attempt).
 *   Terminal codes (410/404/400/403) short-circuit immediately.
 */
export async function processDueReminders({
  remindersCollection,
  subscriptionsCollection,
  sendPush,
  now = new Date(),
  // limit defaults to 20 to fit Vercel cron maxDuration: 10s (vercel.json).
  // Worst case = 20 reminders × N subs × (1 send + sendRetries-1 retries with
  // exp backoff). Real fix is faster cron + smaller sendRetries — see NOTE.md.
  limit = 20,
  sendRetries = DEFAULT_SEND_RETRIES,
  backoffMs = DEFAULT_BACKOFF_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const dueReminders = await remindersCollection
    .find({
      dateTime: { $lte: now },
      status: { $in: ["pending", "in_progress"] },
      notificationSent: { $ne: true },
    })
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
    // Atomic claim — prevents double-send under concurrent cron. The claim
    // is final per RFC 8030 semantics: we delegate offline-device retry to
    // the push server's TTL window, and we don't retro-deliver across crons.
    // mongodb v6 (pinned exact in package.json) resolves findOneAndUpdate to
    // the doc directly, or null on no match. If a future driver upgrade
    // changes this shape, the regression tests fail loud — no silent fallback.
    const claimed = await remindersCollection.findOneAndUpdate(
      { _id: reminder._id, notificationSent: { $ne: true } },
      { $set: { notificationSent: true, notifiedAt: now } },
    );
    if (claimed == null) continue;
    counters.processed++;

    const subs = await subscriptionsCollection
      .find({ userId: reminder.userId })
      .toArray();

    if (subs.length === 0) {
      counters.no_subs++;
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
      const result = await sendWithRetry({
        sub,
        payload,
        sendPush,
        sendRetries,
        backoffMs,
        sleep,
      });
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
          `[cron/notify] Push failed sub=${sub._id} status=${result.statusCode} attempts=${result.attempts}`,
        );
      }
    }

    if (anySucceeded && (anyGone || anyTransient)) counters.partial_success++;
    if (
      !anySucceeded &&
      subs.length > 0 &&
      cleanedThisReminder === subs.length
    ) {
      counters.all_gone++;
    }
  }

  return counters;
}

async function sendWithRetry({
  sub,
  payload,
  sendPush,
  sendRetries,
  backoffMs,
  sleep,
}) {
  let lastResult = { success: false };
  for (let attempt = 1; attempt <= sendRetries; attempt++) {
    const result = await sendPush(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload,
    );
    if (result.success) return { ...result, attempts: attempt };
    if (
      result.statusCode === 410 ||
      result.statusCode === 404 ||
      result.statusCode === 400 ||
      result.statusCode === 403
    ) {
      return { ...result, attempts: attempt };
    }
    lastResult = result;
    if (attempt < sendRetries) {
      await sleep(backoffMs * Math.pow(2, attempt - 1));
    }
  }
  return { ...lastResult, attempts: sendRetries };
}
