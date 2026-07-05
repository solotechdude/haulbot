import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "../../components/EmailButton";
import { EmailHeading } from "../../components/EmailHeading";
import { EmailLayout } from "../../components/EmailLayout";
import { EmailText } from "../../components/EmailText";
import { MarketingFooter } from "../../components/MarketingFooter";
import { theme } from "../../theme";

export interface LaunchAnnouncementEmailProps {
  /** Recipient first name. Falls back to "there" when missing. */
  firstName?: string;
  /** Landing page URL (UTM-tagged for the warm lane). */
  landingUrl?: string;
  /** Opt-out URL. For Resend Broadcasts use "{{{RESEND_UNSUBSCRIBE_URL}}}". */
  unsubscribeUrl?: string;
  /** Physical mailing address for the legal footer. */
  mailingAddress?: string;
}

const WARM_LANDING_URL = "https://haulbot.online?utm_source=email&utm_medium=warm&utm_campaign=launch";

const bullet = {
  margin: `${theme.space[2]} 0 0`,
  fontFamily: theme.font.sans,
  fontSize: "15px",
  lineHeight: "22px",
  color: theme.color.muted,
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <Text style={bullet}>
      <span style={{ color: theme.color.text, fontWeight: 700 }}>·</span> {children}
    </Text>
  );
}

export default function LaunchAnnouncementEmail({
  firstName,
  landingUrl = WARM_LANDING_URL,
  unsubscribeUrl = "#",
  mailingAddress = "[ADD MAILING ADDRESS]",
}: LaunchAnnouncementEmailProps) {
  const name = firstName?.trim() || "there";

  return (
    <EmailLayout
      preview="Your truck can book its own Amazon Relay loads — while you drive."
      footer={<MarketingFooter unsubscribeUrl={unsubscribeUrl} mailingAddress={mailingAddress} />}
    >
      <EmailHeading>Book loads while you drive</EmailHeading>

      <EmailText tone="muted">Hi {name},</EmailText>

      <EmailText tone="muted">
        You can't watch the Amazon Relay load board while you're driving — so the good loads get booked
        by someone else, and you end up taking whatever's left.
      </EmailText>

      <EmailText tone="muted">
        I built Haulbot to fix that. You send one Telegram message — your origin, your minimum
        rate, your minimum payout. A dedicated agent watches Relay around the clock and books loads that
        meet your rules, while you keep both hands on the wheel.
      </EmailText>

      <Section style={{ paddingTop: theme.space[2] }}>
        <Bullet>Books only to your rules — never below your minimum rate or payout.</Bullet>
        <Bullet>Lines up your next leg the moment one gets booked.</Bullet>
        <Bullet>One pinned Telegram status. Pause or cancel anytime.</Bullet>
      </Section>

      <EmailText tone="muted">
        It's $199/mo, cancel anytime, and setup takes a few minutes. Watch it book a load in the 15-second
        demo:
      </EmailText>

      <Section style={{ paddingTop: theme.space[3] }}>
        <EmailButton href={landingUrl}>See how it works</EmailButton>
      </Section>

      <EmailText tone="muted">
        — Aj Karim
        <br />
        <span style={{ color: theme.color.subtle }}>Founder, Haulbot</span>
      </EmailText>
    </EmailLayout>
  );
}

LaunchAnnouncementEmail.PreviewProps = {
  firstName: "Marcus",
  landingUrl: WARM_LANDING_URL,
  unsubscribeUrl: "https://haulbot.online/unsubscribe?token=preview",
  mailingAddress: "Haulbot · 123 Example St, Suite 100, Austin, TX 78701",
} satisfies LaunchAnnouncementEmailProps;
