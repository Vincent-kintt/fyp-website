import { apiSuccess, apiError } from "@/lib/api/response.js";

// GET /api/push/vapid-key — return the VAPID public key for SW re-subscription
// flows (pushsubscriptionchange). The public key is non-secret by design.
// No auth: the SW does not have access to session cookies for module-scoped
// fetches in every browser, and this value is shipped to the client anyway
// via NEXT_PUBLIC_VAPID_PUBLIC_KEY.
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return apiError("VAPID public key not configured", 500);
  }
  return apiSuccess({ publicKey });
}
