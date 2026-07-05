/** 24s @ 30fps — grill-me spec */
export const FPS = 30;
export const DURATION_FRAMES = 24 * FPS;

export const TIMING = {
  driverIn: 15,
  typing1Start: 45,
  typing1End: 75,
  campaignIn: 75,
  keyboardIn: 90,
  typing2Start: 180,
  typing2End: 195,
  scanningIn: 195,
  scanCountStart: 240,
  scanCountEnd: 330,
  bookedIn: 420,
  holdStart: 600,
  loopFadeStart: 660,
  loopFadeEnd: 720,
} as const;

export function scanLoadCount(frame: number): number {
  if (frame < TIMING.scanCountStart) return 8;
  if (frame >= TIMING.scanCountEnd) return 12;
  const t = (frame - TIMING.scanCountStart) / (TIMING.scanCountEnd - TIMING.scanCountStart);
  return Math.round(8 + t * 4);
}
