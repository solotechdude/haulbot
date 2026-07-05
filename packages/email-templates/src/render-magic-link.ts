import { render } from "@react-email/render";
import MagicLinkEmail from "../emails/magic-link";

export interface MagicLinkEmailProps {
  /** Magic-link URL to the /solo subscriber portal (already contains the token). */
  portalUrl: string;
  /** Optional recipient email, shown for account clarity. */
  driverEmail?: string;
}

export async function renderMagicLinkEmail(
  props: MagicLinkEmailProps,
): Promise<{ html: string; text: string }> {
  const element = MagicLinkEmail(props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}
