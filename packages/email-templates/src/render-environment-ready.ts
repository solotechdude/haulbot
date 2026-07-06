import { render } from "@react-email/render";
import EnvironmentReadyEmail from "../emails/environment-ready";

export interface EnvironmentReadyEmailProps {
  /** Magic-link URL to the /solo subscriber portal (already contains the token). */
  portalUrl: string;
  /** Optional recipient email, shown for account clarity. */
  driverEmail?: string;
}

export async function renderEnvironmentReadyEmail(
  props: EnvironmentReadyEmailProps,
): Promise<{ html: string; text: string }> {
  const element = EnvironmentReadyEmail(props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}
