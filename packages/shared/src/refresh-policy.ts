/**
 * Smart refresh strategy for the extension's load board polling.
 *
 * Amazon Relay's built-in refresh runs every 15–30s and stops when the tab
 * loses focus. The extension refreshes on its own timer driven by this
 * policy, which rides the dispatch_states hot path so no extra poll channel
 * is needed. The backend tunes it from Market Intelligence (lane posting
 * windows) and extension-reported 429/503 rates.
 */

/** Analytics-predicted posting window — refresh faster while inside it. */
export interface RefreshHotWindow {
  startsAt: string;
  endsAt: string;
  intervalMs: number;
}

export interface RefreshBackoff {
  /** First wait after a 429/503 */
  initialMs: number;
  /** Multiplier per consecutive failure */
  multiplier: number;
  /** Backoff ceiling */
  maxMs: number;
}

export interface RefreshPolicy {
  /** Interval between board refreshes in steady state */
  baseIntervalMs: number;
  /** Floor — never refresh faster than this, even inside hot windows */
  minIntervalMs: number;
  /** Ceiling used while idle or deferred (readiness window not open) */
  maxIntervalMs: number;
  /** 0..1 — random jitter fraction applied to every interval to avoid fleet sync */
  jitterRatio: number;
  backoff: RefreshBackoff;
  /** Honor Retry-After response headers over computed backoff */
  respectRetryAfter: boolean;
  hotWindows?: RefreshHotWindow[];
  updatedAt: string;
}

export const DEFAULT_REFRESH_POLICY: Omit<RefreshPolicy, "updatedAt"> = {
  baseIntervalMs: 12_000,
  minIntervalMs: 5_000,
  maxIntervalMs: 60_000,
  jitterRatio: 0.25,
  backoff: { initialMs: 30_000, multiplier: 2, maxMs: 600_000 },
  respectRetryAfter: true,
};

/** Policy for a state read — user override when set, default otherwise. */
export function resolveRefreshPolicy(override?: RefreshPolicy | null): RefreshPolicy {
  if (override) return override;
  return { ...DEFAULT_REFRESH_POLICY, updatedAt: new Date(0).toISOString() };
}

/**
 * Next refresh delay in ms — reference implementation for the extension.
 * Hot windows override the base interval; consecutive 429/503 failures apply
 * exponential backoff; jitter desynchronizes the fleet.
 */
export function nextRefreshDelayMs(
  policy: RefreshPolicy,
  input: { now?: Date; consecutiveFailures?: number; deferred?: boolean } = {},
): number {
  const now = input.now ?? new Date();
  const failures = input.consecutiveFailures ?? 0;

  if (failures > 0) {
    const raw = policy.backoff.initialMs * policy.backoff.multiplier ** (failures - 1);
    return Math.min(raw, policy.backoff.maxMs);
  }

  let interval = input.deferred ? policy.maxIntervalMs : policy.baseIntervalMs;

  const hot = policy.hotWindows?.find(
    (w) => new Date(w.startsAt) <= now && now <= new Date(w.endsAt),
  );
  if (hot && !input.deferred) interval = hot.intervalMs;

  interval = Math.max(policy.minIntervalMs, Math.min(interval, policy.maxIntervalMs));

  const jitter = interval * policy.jitterRatio * Math.random();
  return Math.round(interval + jitter);
}
