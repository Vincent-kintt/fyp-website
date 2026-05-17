import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Missing VAPID configuration. Run: npm run generate-vapid"
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Send push notification to a subscription
 * @param {Object} subscription - { endpoint, keys: { p256dh, auth } }
 * @param {Object} payload - { title, body, tag, url, reminderId }
 * @returns {Promise<{ success: boolean, statusCode?: number, error?: string }>}
 */
export async function sendPushNotification(subscription, payload) {
  ensureConfigured();

  try {
    // TTL: 86400 (24h) is set here because the app cron runs daily.
    // Push services hold the message for up to TTL seconds, retrying delivery
    // to the user agent while offline. With a 24h cron cadence + 24h TTL we
    // guarantee at-least-once delivery for users who come online any time in
    // the next ~24h. If the cron is later moved to a higher frequency, lower
    // this to 900 (15m) per industry best practice for time-sensitive personal
    // reminders — long-window retro delivery is bad UX.
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      { TTL: 86400 }
    );
    return { success: true, statusCode: result.statusCode };
  } catch (error) {
    return {
      success: false,
      statusCode: error.statusCode,
      error: error.message,
    };
  }
}
