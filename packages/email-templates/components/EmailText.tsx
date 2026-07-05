import { Text } from "@react-email/components";
import * as React from "react";
import { theme } from "../theme";

type Tone = "body" | "muted" | "subtle";
type Size = "base" | "small";

const toneColor: Record<Tone, string> = {
  body: theme.color.text,
  muted: theme.color.muted,
  subtle: theme.color.subtle,
};

const sizeStyle: Record<Size, { fontSize: string; lineHeight: string }> = {
  base: { fontSize: "15px", lineHeight: "24px" },
  small: { fontSize: "13px", lineHeight: "22px" },
};

/**
 * Standard body paragraph for emails. `tone` sets the color role and `size`
 * switches between primary copy and secondary/fine print. First paragraph in a
 * block can drop its top margin with `flush`.
 */
export function EmailText({
  tone = "muted",
  size = "base",
  flush = false,
  children,
}: {
  tone?: Tone;
  size?: Size;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Text
      style={{
        margin: flush ? 0 : `${theme.space[3]} 0 0`,
        fontFamily: theme.font.sans,
        color: toneColor[tone],
        ...sizeStyle[size],
      }}
    >
      {children}
    </Text>
  );
}
