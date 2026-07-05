import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ChatFrame, ChatRow } from "../components/ChatFrame";
import { MessageBubble } from "../components/MessageBubble";
import { ReplyKeyboard } from "../components/ReplyKeyboard";
import { TypingIndicator } from "../components/TypingIndicator";
import { heroChat, heroScanningLine } from "@haulbot/shared/marketing/hero-chat";
import { useBubbleEnter } from "../lib/motion";
import { CHAT_HEIGHT, CHAT_WIDTH } from "../theme/chat-tokens";
import { scanLoadCount, TIMING } from "../theme/timing";

function AnimatedRow({
  from,
  startFrame,
  children,
}: {
  from: "driver" | "bot";
  startFrame: number;
  children: ReactNode;
}) {
  const motion = useBubbleEnter(startFrame);
  if (motion.opacity === 0) return null;

  return (
    <ChatRow
      from={from}
      style={{ opacity: motion.opacity, translate: motion.translate } as CSSProperties}
    >
      {children}
    </ChatRow>
  );
}

function TypingRow({ startFrame, endFrame }: { startFrame: number; endFrame: number }) {
  const frame = useCurrentFrame();
  if (frame < startFrame || frame >= endFrame) return null;

  return (
    <ChatRow from="bot">
      <TypingIndicator />
    </ChatRow>
  );
}

export function HeroCampaignDemo() {
  const frame = useCurrentFrame();

  const messageOpacity =
    frame >= TIMING.loopFadeStart
      ? interpolate(frame, [TIMING.loopFadeStart, TIMING.loopFadeEnd], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        })
      : 1;

  const scanCount = scanLoadCount(frame);
  const [m0, m1, m2, m3] = heroChat;

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa" }}>
      <ChatFrame messageOpacity={messageOpacity}>
        <AnimatedRow from="driver" startFrame={TIMING.driverIn}>
          <MessageBubble from="driver" text={m0.text} time={m0.time} mono={m0.mono} />
        </AnimatedRow>

        <TypingRow startFrame={TIMING.typing1Start} endFrame={TIMING.typing1End} />

        {frame >= TIMING.campaignIn ? (
          <AnimatedRow from="bot" startFrame={TIMING.campaignIn}>
            <MessageBubble from="bot" text={m1.text} time={m1.time} />
            {m1.buttons ? (
              <ReplyKeyboard buttons={m1.buttons} startFrame={TIMING.keyboardIn} />
            ) : null}
          </AnimatedRow>
        ) : null}

        <TypingRow startFrame={TIMING.typing2Start} endFrame={TIMING.typing2End} />

        {frame >= TIMING.scanningIn ? (
          <AnimatedRow from="bot" startFrame={TIMING.scanningIn}>
            <MessageBubble from="bot" text={heroScanningLine(scanCount)} time={m2.time} />
          </AnimatedRow>
        ) : null}

        {frame >= TIMING.bookedIn ? (
          <AnimatedRow from="bot" startFrame={TIMING.bookedIn}>
            <MessageBubble
              from="bot"
              text={m3.text}
              time={m3.time}
              accentLines={["DFW → ATL · $850", "$850"]}
            />
          </AnimatedRow>
        ) : null}
      </ChatFrame>
    </AbsoluteFill>
  );
}

/** Composition matches chat shell exactly — no outer padding shell */
export const HERO_COMPOSITION = {
  width: CHAT_WIDTH,
  height: CHAT_HEIGHT,
  fps: 30,
  durationInFrames: 24 * 30,
} as const;
