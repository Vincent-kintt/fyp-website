Follow-up flags after cluster M.2 (post-revert):

1. **Cron frequency**: currently daily (`0 0 * * *` in vercel.json). For time-sensitive
   personal reminders, industry norm is every 1-5 minutes. With daily cron, a 3pm reminder
   isn't pushed until next midnight (up to 21h late). Real architectural fix: move to
   every 5 min on a Vercel pro plan (current plan limits unknown).

2. **TTL**: when cron is fast, lower `TTL: 86400` in `lib/push.js` to 900 (15min). Retro
   delivery is bad UX (Netguru, Apple APNs default behavior).

3. **In-app overdue UI**: canonical fallback when push fails / is too late. User opens app,
   sees "missed reminders" list. Currently no such surface exists in the codebase.

4. **transient-500 attempt cap**: cluster M.2 retries 3x within one cron tick. If push
   service has sustained outage, all 3 will fail and notification is lost. Acceptable for
   now (rare). For higher reliability: track `notificationAttempts` counter, allow next-cron
   retry with backoff, AS LONG AS cron is fast enough that the retry is still timely.

5. **Vercel cron 10s budget vs limit=20**: `vercel.json` pins `app/api/cron/**/*.js` to
   `maxDuration: 10s`. The helper's default `limit = 20` is defensive against that ceiling
   — worst case per tick is 20 reminders × N subs × (1 send + 2 exp-backoff retries of
   500ms + 1000ms = 1.5s wait). Bumping limit without first lowering `sendRetries` (or
   moving to a Pro plan with a faster cron schedule) risks tripping the 10s timeout
   mid-loop, leaving claimed-but-unsent reminders (notificationSent:true is final per
   RFC 8030, so we'd lose them). The proper sequencing is: faster cron (every 5 min on
   Vercel Pro) → smaller `sendRetries` (e.g. 2) → only then raise `limit`. Keeping the
   default at 20 preserves the retry budget without requiring callers to know any of this.
