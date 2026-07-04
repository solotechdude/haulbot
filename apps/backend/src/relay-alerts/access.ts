import type { RelayAccessIssue, RelayAccessIssueKind } from "@haulbot/shared";
import { getDb, getDispatchState, upsertDispatchState } from "../db";
import { syncCampaignStatusMessage } from "../telegram/campaign-status";
import { sendTelegramMessage } from "../telegram/notify";

/**
 * Relay access problems (blocking page states). The extension reports them;
 * the backend holds dispatch, tells the Driver what to do in Telegram, and
 * announces recovery. Load events (cancel etc.) stay in ./record.ts.
 */

export function driverMessageForAccessIssue(kind: RelayAccessIssueKind): string {
  switch (kind) {
    case "permission_denied":
      return (
        "Amazon Relay is blocking the load board:\n" +
        "“You do not have permissions to view this page.”\n\n" +
        "Your Relay account needs Load Board permission from your carrier administrator. " +
        "Dispatch is on hold — searching resumes automatically once access is restored."
      );
    case "session_expired":
      return (
        "Your Amazon Relay session is signed out, so no loads are being searched.\n\n" +
        "Sign back in to Amazon Relay in your dispatch browser (the load board must be " +
        "reachable at relay.amazon.com/loadboard/search). Searching resumes automatically " +
        "once you're signed in."
      );
    case "login_failed":
      return (
        "Relay rejected your saved login.\n\n" +
        "Send /connect_relay to update your Amazon Relay credentials. " +
        "Dispatch is on hold until login succeeds."
      );
    case "2fa_required":
      return (
        "Relay is asking for a two-step verification code.\n\n" +
        "Send it here as: /2fa 123456\n" +
        "Dispatch is on hold until the code is accepted."
      );
    case "captcha":
      return (
        "Relay is showing a human verification check that your agent can't pass on its own.\n\n" +
        "We'll keep retrying. If this persists for more than a few minutes, contact support."
      );
  }
}

/**
 * Kinds resolved silently without pinging the Driver. Empty: every blocking
 * state the extension reports is one it verified on the load board and cannot
 * fix on its own (no auto-login), so the Driver must always be told — never
 * left thinking the agent is searching. reportRelayAccessIssue dedupes by
 * kind, so this is one message per incident, not per poll.
 */
const QUIET_KINDS: RelayAccessIssueKind[] = [];

export async function reportRelayAccessIssue(
  userId: string,
  input: { kind: RelayAccessIssueKind; message?: string },
): Promise<{ notified: boolean }> {
  const now = new Date().toISOString();
  const state = await getDispatchState(userId);

  // Same unresolved issue → already held + notified; don't spam every poll
  if (state?.relayAccess?.kind === input.kind) return { notified: false };

  const issue: RelayAccessIssue = {
    kind: input.kind,
    message: input.message,
    detectedAt: now,
  };

  const next = state ?? {
    userId,
    paused: false,
    activeLeg: null,
    commitment: null,
    updatedAt: now,
  };
  next.relayAccess = issue;
  next.updatedAt = now;
  await upsertDispatchState(next);

  const db = await getDb();

  if (input.kind === "2fa_required") {
    await db.collection("users").updateOne(
      { id: userId },
      { $set: { relay2faPending: true, relayReadyAt: null, updatedAt: now } },
    );
  }
  if (input.kind === "login_failed") {
    await db.collection("users").updateOne(
      { id: userId },
      { $set: { relayReadyAt: null, updatedAt: now } },
    );
  }

  await db.collection("environment_events").insertOne({
    userId,
    environmentId: null,
    type: `relay_access_${input.kind}`,
    message: input.message ?? driverMessageForAccessIssue(input.kind).split("\n")[0],
    createdAt: now,
  });

  const shouldNotify = !QUIET_KINDS.includes(input.kind);
  if (shouldNotify) {
    await sendTelegramMessage(userId, driverMessageForAccessIssue(input.kind));
  }

  // Pinned campaign status flips to "Relay access blocked" immediately
  await syncCampaignStatusMessage(userId, next, null);

  return { notified: shouldNotify };
}

/** Extension confirms Relay is reachable again. */
export async function clearRelayAccessIssue(userId: string): Promise<{ cleared: boolean }> {
  const state = await getDispatchState(userId);
  if (!state?.relayAccess) return { cleared: false };

  const resolvedKind = state.relayAccess.kind;
  const now = new Date().toISOString();

  state.relayAccess = null;
  state.updatedAt = now;
  await upsertDispatchState(state);

  const db = await getDb();
  await db.collection("environment_events").insertOne({
    userId,
    environmentId: null,
    type: "relay_access_restored",
    message: `Recovered from ${resolvedKind}`,
    createdAt: now,
  });

  // Quiet kinds resolved silently; the driver never saw a problem
  if (!QUIET_KINDS.includes(resolvedKind)) {
    const resuming = state.activeLeg && !state.paused;
    await sendTelegramMessage(
      userId,
      `Relay access restored.${resuming ? " Your agent is searching again." : " Use /campaign or /goal when ready."}`,
    );
  }

  await syncCampaignStatusMessage(userId, state, null);

  return { cleared: true };
}
