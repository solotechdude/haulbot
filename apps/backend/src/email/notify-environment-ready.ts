import { issueCheckoutToken, soloPortalUrl } from "../auth/magic-link";
import { getDb } from "../db";
import { sendEnvironmentReadyEmail } from "./mailer";

/** Send once when the dedicated environment first becomes ready. */
export async function notifyEnvironmentReady(userId: string): Promise<void> {
  const db = await getDb();
  const user = await db.collection("users").findOne({ id: userId });
  if (!user?.email) return;
  if (user.environmentReadyEmailSentAt) return;

  const token = await issueCheckoutToken(userId);
  const portalUrl = soloPortalUrl(token);
  const email = String(user.email);

  try {
    await sendEnvironmentReadyEmail(email, portalUrl);
  } catch (err) {
    console.error("[email] environment-ready notify failed for %s:", userId, err);
    return;
  }

  await db.collection("users").updateOne(
    { id: userId },
    { $set: { environmentReadyEmailSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  );
}
