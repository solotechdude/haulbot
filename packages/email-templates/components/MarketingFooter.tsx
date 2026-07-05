import { Hr, Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { brand, theme } from "../theme";

/**
 * Footer for marketing / broadcast emails. Unlike the transactional footer,
 * this one carries the legally required unsubscribe link and physical mailing
 * address (CAN-SPAM / CASL). Never reuse the transactional footer for cold or
 * bulk marketing sends.
 */
export function MarketingFooter({
  unsubscribeUrl,
  mailingAddress,
}: {
  /** Working opt-out URL. For Resend Broadcasts use "{{{RESEND_UNSUBSCRIBE_URL}}}". */
  unsubscribeUrl: string;
  /** Real physical postal address — required by law before sending. */
  mailingAddress: string;
}) {
  const small = {
    margin: `${theme.space[2]} 0 0`,
    fontFamily: theme.font.sans,
    fontSize: "12px",
    lineHeight: "18px",
    color: theme.color.subtle,
  };

  return (
    <Section>
      <Hr style={{ borderColor: theme.color.border, margin: `${theme.space[5]} 0 ${theme.space[3]}` }} />
      <Text style={{ ...small, margin: 0 }}>
        You're receiving this because you expressed interest in dispatch tools for Amazon Relay.{" "}
        <Link href={unsubscribeUrl} style={{ color: theme.color.muted, textDecoration: "underline" }}>
          Unsubscribe
        </Link>{" "}
        anytime.
      </Text>
      <Text style={small}>{mailingAddress}</Text>
      <Text style={small}>
        {brand.productName} — not affiliated with or endorsed by Amazon. Questions? Reach us at{" "}
        <Link href={`mailto:${brand.supportEmail}`} style={{ color: theme.color.muted, textDecoration: "underline" }}>
          {brand.supportEmail}
        </Link>
        .
      </Text>
    </Section>
  );
}
