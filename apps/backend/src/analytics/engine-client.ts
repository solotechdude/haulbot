import type { LaneInsights, LoadTelemetryBatch, RefreshHotWindow } from "@relaybooking/shared";

/**
 * Load Analytics Engine client — external multi-product platform
 * (location analytics repo). SOLO feeds Load Telemetry in and consumes
 * Market Intelligence out. All calls degrade gracefully when the engine
 * is not configured or unreachable.
 */

function engineUrl(): string | null {
  return process.env.ANALYTICS_ENGINE_URL ?? null;
}

function engineHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.ANALYTICS_ENGINE_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function isEngineConfigured(): boolean {
  return Boolean(engineUrl());
}

/** Standard interface — same endpoint shape as other Relay booking extensions. */
export async function forwardLoadTelemetry(
  userId: string,
  batch: LoadTelemetryBatch,
): Promise<void> {
  const url = engineUrl();
  if (!url) return;

  try {
    const res = await fetch(`${url}/v1/telemetry/relay`, {
      method: "POST",
      headers: engineHeaders(),
      body: JSON.stringify({ source: "solo", userId, ...batch }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn("[analytics] telemetry forward failed:", res.status);
  } catch (err) {
    console.warn("[analytics] telemetry forward error:", (err as Error).message);
  }
}

export async function fetchLaneInsights(
  origin: string,
  destination?: string,
): Promise<LaneInsights | null> {
  const url = engineUrl();
  if (!url) return null;

  const params = new URLSearchParams({ origin });
  if (destination && destination.toUpperCase() !== origin.toUpperCase()) {
    params.set("destination", destination);
  }

  try {
    const res = await fetch(`${url}/v1/lanes/insights?${params}`, {
      headers: engineHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as LaneInsights;
  } catch (err) {
    console.warn("[analytics] lane insights error:", (err as Error).message);
    return null;
  }
}

const HOT_WINDOW_INTERVAL_MS = 6_000;
const HOT_WINDOW_MIN_CONFIDENCE = 0.5;

/** Posting windows → refresh hot windows the extension acts on. */
export function postingWindowsToHotWindows(insights: LaneInsights | null): RefreshHotWindow[] {
  if (!insights?.postingWindows?.length) return [];
  return insights.postingWindows
    .filter((w) => w.confidence >= HOT_WINDOW_MIN_CONFIDENCE)
    .map((w) => ({ startsAt: w.startsAt, endsAt: w.endsAt, intervalMs: HOT_WINDOW_INTERVAL_MS }));
}
