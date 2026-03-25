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
