/**
 * Load Telemetry — the standard interface every Relay booking extension
 * emits to the Load Analytics Engine (see CONTEXT.md). Three data points:
 * loads seen, loads booked, loads attempted and missed.
 */

export type LoadTelemetryKind = "load_seen" | "load_booked" | "load_missed";

export type LoadMissReason = "gone_before_book" | "book_error" | "rate_limited" | "below_rules";

/** Load board row snapshot — the analytics engine's unit of ingestion. */
export interface LoadSnapshot {
  loadId?: string;
  origin?: string;
  destination?: string;
  stops?: number;
  payout?: number;
  ratePerMile?: number;
  distanceMiles?: number;
  equipment?: string;
  pickupAt?: string;
  deliveryAt?: string;
  /** When the load first appeared on the board — key input for posting-time analysis */
  firstSeenAt?: string;
}

export interface LoadTelemetryEvent {
  kind: LoadTelemetryKind;
  observedAt: string;
  load: LoadSnapshot;
  missReason?: LoadMissReason;
}

/** Extension-observed Relay backpressure — input for refresh policy tuning. */
export interface BoardHealthSample {
  requests: number;
  rateLimited429: number;
  serverErrors5xx: number;
  windowStartedAt: string;
  windowEndedAt: string;
}

export interface LoadTelemetryBatch {
  events: LoadTelemetryEvent[];
  boardHealth?: BoardHealthSample;
}

/**
 * Market Intelligence — what the Load Analytics Engine returns per lane.
 * Shared here because it is the cross-repo contract between SOLO and the
 * analytics backend.
 */

export interface LanePostingWindow {
  /** ISO timestamps within the requested horizon — engine resolves recurrence */
  startsAt: string;
  endsAt: string;
  /** 0..1 — historical share of good loads posted inside this window */
  confidence: number;
}

export interface LaneInsights {
  origin: string;
  destination?: string;
  avgRatePerMile?: number;
  avgPayout?: number;
  /** Loads seen per day on this lane, recent window */
  dailyLoadVolume?: number;
  postingWindows?: LanePostingWindow[];
  /** Human-readable guidance surfaced to the Driver at handoff/briefing */
  recommendation?: string;
}
