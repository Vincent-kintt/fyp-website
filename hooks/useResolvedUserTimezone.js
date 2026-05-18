"use client";

import { useMemo } from "react";

/**
 * Resolve the user's IANA timezone for use with `buildSubmitPayload`.
 *
 * The app does not yet persist a per-account IANA timezone (see audit H7 —
 * the AI paths already derive it from
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` on the client, which
 * has the same machine-vs-account gap). When a per-account timezone DOES
 * land in user settings, swap the body of this hook to read it from the
 * settings context and drop the warn. Until then, we fall back to the
 * browser-resolved TZ — this is NOT correct for traveling users but it's
 * what every other client path already does, and a `console.warn` makes the
 * fallback auditable.
 *
 * Extracted from TaskEditForm during the H7 follow-up so QuickAdd (and any
 * future form) can reuse the same resolution + audit-warn behaviour.
 *
 * @returns {string|null} IANA timezone string, or `null` when the runtime
 *                        has no Intl support (SSR before hydration, or a
 *                        very old browser). Callers MUST handle null by
 *                        either skipping conversion (no `dateTime` to
 *                        convert) or surfacing an error.
 */
export function useResolvedUserTimezone() {
  return useMemo(() => {
    if (typeof Intl === "undefined" || !Intl.DateTimeFormat) return null;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) {
      console.warn(
        "useResolvedUserTimezone: could not resolve user IANA timezone — submit will reject",
      );
      return null;
    }
    // WHY warn: this is the browser's machine TZ, not the user's account TZ.
    // For now they're treated as the same; flagged so we don't lose track.
    console.warn(
      `useResolvedUserTimezone: using browser-resolved timezone ${tz} (no per-account TZ persisted yet)`,
    );
    return tz;
  }, []);
}
