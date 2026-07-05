import { Section } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "../components/EmailButton";
import { EmailHeading } from "../components/EmailHeading";
import { EmailLayout } from "../components/EmailLayout";
import { EmailText } from "../components/EmailText";
import { theme } from "../theme";

export interface MagicLinkEmailProps {
  /** Magic-link URL to the /solo subscriber portal (already contains the token). */
  portalUrl: string;
  /** Optional recipient email, shown for account clarity. */
  driverEmail?: string;
}

export default function MagicLinkEmail({ portalUrl, driverEmail }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your Haulbot sign-in link">
      <EmailHeading>Sign in to Haulbot</EmailHeading>

      <EmailText>
        Use the button below to sign in to your subscriber portal. No password needed — this link
        signs you in securely.
      </EmailText>

      <Section style={{ paddingTop: theme.space[4] }}>
        <EmailButton href={portalUrl}>Sign in</EmailButton>
      </Section>

      <EmailText tone="subtle" size="small">
        This link expires in 15 minutes and can only be used once. If the button doesn't work,
        copy and paste this URL into your browser:
        <br />
        <span style={{ color: theme.color.muted, wordBreak: "break-all" }}>{portalUrl}</span>
      </EmailText>

      <EmailText tone="subtle" size="small">
        Didn't request this? You can safely ignore this email{driverEmail ? ` sent to ${driverEmail}` : ""} — nobody
        can sign in without the link above.
      </EmailText>
    </EmailLayout>
  );
}

MagicLinkEmail.PreviewProps = {
  portalUrl: "https://haulbot.online/solo?token=preview-magic-link-token",
  driverEmail: "driver@example.com",
} satisfies MagicLinkEmailProps;
