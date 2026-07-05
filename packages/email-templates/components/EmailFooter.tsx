import { Hr, Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { brand, theme } from "../theme";

export function EmailFooter() {
  return (
    <Section>
      <Hr style={{ borderColor: theme.color.border, margin: `${theme.space[5]} 0 ${theme.space[3]}` }} />
      <Text
        style={{
          margin: 0,
          fontFamily: theme.font.sans,
          fontSize: "13px",
          lineHeight: "20px",
          color: theme.color.subtle,
        }}
      >
        Questions? Reach us at{" "}
        <Link href={`mailto:${brand.supportEmail}`} style={{ color: theme.color.muted, textDecoration: "underline" }}>
          {brand.supportEmail}
        </Link>
        .
      </Text>
      <Text
        style={{
          margin: `${theme.space[2]} 0 0`,
          fontFamily: theme.font.sans,
          fontSize: "12px",
          lineHeight: "18px",
          color: theme.color.subtle,
        }}
      >
        {brand.productName} — AI dispatch for solo Amazon Relay owner-operators.
      </Text>
    </Section>
  );
}
