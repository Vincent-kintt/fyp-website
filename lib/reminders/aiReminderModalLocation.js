// Pure helpers for AIReminderModal location resolution.
// Extracted so the (coord fetch) vs (label reverse-geocode) effects can be
// split in the component: language toggles must not re-prompt for GPS.

const GEO_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 3600000,
});

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";

function acceptLanguageFor(language) {
  return language === "zh" ? "zh-TW" : "en";
}

/**
 * Cache key for reverse-geocoded labels.
 * MUST include language: Nominatim returns localized strings (city/country),
 * so an EN-cached "Hong Kong" cannot satisfy a ZH request for "香港".
 */
export function getCacheKey(coords, language) {
  if (!coords) return null;
  const lat = Number(coords.latitude).toFixed(4);
  const lon = Number(coords.longitude).toFixed(4);
  return `${lat},${lon}:${acceptLanguageFor(language)}`;
}

/**
 * Browser geolocation as a Promise. Resolves to { latitude, longitude } on
 * success, null on denial / unavailable. Never throws.
 *
 * @param {{ navigator: object, log?: (msg: string, err?: unknown) => void }} deps
 */
export function executeGeolocation({ navigator, log = noopLog }) {
  return new Promise((resolve) => {
    if (!navigator?.geolocation?.getCurrentPosition) {
      log("[AIReminderModal] geolocation: API unavailable");
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => {
        log("[AIReminderModal] geolocation: permission denied or error", err);
        resolve(null);
      },
      GEO_OPTIONS,
    );
  });
}

/**
 * Reverse-geocode coords into a localized address via Nominatim, with a
 * caller-supplied cache. Returns the address object or null on failure.
 *
 * @param {{
 *   coords: { latitude: number, longitude: number } | null,
 *   language: string,
 *   fetch: typeof fetch,
 *   cache: { get: (k: string) => any, set: (k: string, v: any) => void },
 *   log?: (msg: string, err?: unknown) => void,
 * }} deps
 */
export async function executeReverseGeocode({
  coords,
  language,
  fetch: fetchFn,
  cache,
  log = noopLog,
}) {
  if (!coords) return null;
  const key = getCacheKey(coords, language);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const url = `${NOMINATIM_BASE}?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=${acceptLanguageFor(language)}`;
    const response = await fetchFn(url);
    const data = await response.json();
    const result = {
      city:
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        null,
      region: data.address?.state || data.address?.province || null,
      country: data.address?.country || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    cache.set(key, result);
    return result;
  } catch (err) {
    log("[AIReminderModal] reverse-geocode failed", err);
    return null;
  }
}

function noopLog() {}
