import { Section } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "../components/EmailButton";
import { EmailHeading } from "../components/EmailHeading";
import { EmailLayout } from "../components/EmailLayout";
import { EmailText } from "../components/EmailText";
import { theme } from "../theme";

export interface WelcomeEmailProps {
  /** Optional link to the /solo portal so the driver can watch onboarding progress. */
  portalUrl?: string;
  /** Optional recipient email, shown for account clarity. */
  driverEmail?: string;
}

export default function WelcomeEmail({ portalUrl, driverEmail }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to Haulbot — we're setting up your dispatch environment.">
      <EmailHeading>You're in</EmailHeading>

      <EmailText>
        Thanks for subscribing to Haulbot. We're now provisioning your dedicated dispatch
        environment — a private setup that searches and books loads on Amazon Relay for you.
      </EmailText>

      <EmailText>
        This takes a few minutes. We'll email you the moment it's ready with a link to sign in and
        connect Telegram, where you'll set your goals and get booking updates.
      </EmailText>

      {portalUrl ? (
        <Section style={{ paddingTop: theme.space[4] }}>
          <EmailButton href={portalUrl}>View your account</EmailButton>
        </Section>
      ) : null}

      {driverEmail ? (
        <EmailText tone="subtle" size="small">
          This message was sent to {driverEmail}.
        </EmailText>
      ) : null}
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  portalUrl: "https://haulbot.online/solo?token=preview-magic-link-token",
  driverEmail: "driver@example.com",
} satisfies WelcomeEmailProps;
