/**
 * Where the class-reminder relay (worker/) lives.
 *
 * Hand-maintained, like data/holidays.js. Leave apiBase empty and the app simply
 * reports in Settings that reminders are not set up - nothing else changes.
 *
 *   apiBase  the deployed Worker's origin, e.g. "https://iiserk-reminders.<account>.workers.dev"
 *            (no trailing slash). Must be https (http://localhost is accepted for development).
 *
 * Both values are public. The signing key stays a secret on the Worker; the
 * public key is fetched from it, so there is nothing else to keep in sync.
 */
window.REMINDER_CONFIG = {
  apiBase: ''
};
