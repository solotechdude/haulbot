/**
 * Relay session/access problems the extension can hit mid-dispatch —
 * blocking page states, not load events (those are relay_alerts).
 */

export type RelayAccessIssueKind =
  /** "You do not have permissions to view this page" on the load board */
  | "permission_denied"
  /** Relay signed the session out; agent re-login in progress or needed */
  | "session_expired"
  /** Stored credentials rejected at login */
  | "login_failed"
  /** Relay is asking for a 2FA code */
  | "2fa_required"
  /** CAPTCHA / human verification wall */
  | "captcha";

export interface RelayAccessIssue {
  kind: RelayAccessIssueKind;
  /** Raw page text captured by the extension, for the admin timeline */
  message?: string;
  detectedAt: string;
}
