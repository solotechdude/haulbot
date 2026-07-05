import { Easing, interpolate, useCurrentFrame } from "remotion";

export function useBubbleEnter(startFrame: number) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0) return { opacity: 0, translate: "0px 12px" };

  const opacity = interpolate(local, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const y = interpolate(local, [0, 12], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return { opacity, translate: `0px ${y}px` };
}

export function useFadeIn(startFrame: number, duration = 12) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  return interpolate(local, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}
