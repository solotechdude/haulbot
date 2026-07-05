import { Heading } from "@react-email/components";
import * as React from "react";
import { theme } from "../theme";

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: 0,
        fontFamily: theme.font.sans,
        fontSize: "24px",
        fontWeight: 700,
        lineHeight: "30px",
        letterSpacing: "-0.02em",
        color: theme.color.text,
      }}
    >
      {children}
    </Heading>
  );
}
