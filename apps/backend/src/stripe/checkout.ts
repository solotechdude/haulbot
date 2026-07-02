import { soloPortalUrl, issueMagicLinkToken } from "../auth/magic-link";
import { getStripe } from "./client";
import { ensureUserByEmail } from "../users";

function websiteOrigin(): string {
  return process.env.WEBSITE_URL ?? "http://localhost:3000";
}

export async function createSoloCheckoutSession(
  email: string,
): Promise<{ url: string; userId: string; portalUrl?: string }> {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!stripe) throw new Error("STRIPE_NOT_CONFIGURED");
  if (!priceId) throw new Error("STRIPE_PRICE_ID_NOT_CONFIGURED");

  const user = await ensureUserByEmail(email);
  const magicToken = await issueMagicLinkToken(user.id);
  const portalUrl = soloPortalUrl(magicToken);
  const origin = websiteOrigin();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: {
      metadata: { userId: user.id },
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/solo?checkout=success&token=${magicToken}`,
    cancel_url: `${origin}/?checkout=canceled`,
  });

  if (!session.url) throw new Error("CHECKOUT_URL_MISSING");

  return { url: session.url, userId: user.id, portalUrl };
}
