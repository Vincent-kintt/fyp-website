/**
 * Shared auth-form validation constants.
 *
 * Imported by both the client register page and the server register route so
 * client-side preflight matches the server's accept/reject decision exactly.
 * Without this, the client used a permissive regex and the server used the
 * strict HTML5 spec — a valid-looking email at the client could be 400'd by
 * the server after submission.
 */

/** Username: 3-20 chars, alphanumeric and underscores only. */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * Email: HTML5-spec strict regex (rejects characters like <>"').
 * Source of truth — the client must match this exactly.
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** RFC 5321 path length cap. */
export const EMAIL_MAX_LENGTH = 254;
