/** Hot-path document the extension polls — see docs/data-model.md */

export type DispatchMode = "goal" | "campaign";

export type CommitmentStatus = "booked" | "picked_up" | "delivered" | "canceled";

/** Relay load board filters — what Amazon returns as search results. */
export interface SearchCriteria {
  origin?: string;
  destination?: string;
  radius?: number;
  heading?: string;
  equipment?: import("./campaign.js").EquipmentSelection;
  /** Relay UI min $/mi — defaults to Hard Rules min when unset and Wide Net is off */
  boardMinRate?: number;
  /** Relay UI min payout — defaults to Hard Rules min when unset and Wide Net is off */
  boardMinPayout?: number;
  /** When true, omit board price mins on Relay for wider telemetry */
  wideNet?: boolean;
  /** @deprecated use hardRules + boardMinRate */
  minRate?: number;
  /** @deprecated use hardRules + boardMinPayout */
  minPayout?: number;
}

/** Autobooker gates — minimum thresholds before auto-booking. */
export interface HardRules {
  minRate?: number;
  minPayout?: number;
}

export interface ActiveLeg {
  mode: DispatchMode;
  searchCriteria: SearchCriteria;
  hardRules: HardRules;
  bookPriority?: import("./campaign.js").BookPriority;
  readinessWindow?: string;
  searchOpensAt?: string;
}

export interface Commitment {
  loadId: string;
  origin: string;
  destination: string;
  deliveryEta?: string;
  pickupAt?: string;
  status: CommitmentStatus;
}

/** Relay UI booking not initiated by our agent — awaiting driver confirmation */
export interface PendingAdoption {
  loadId: string;
  idKind?: "trip" | "order";
  payout?: number;
  ratePerMile?: number;
  detectedAt: string;
  source: "relay_ui";
}

export interface DispatchState {
  userId: string;
  paused: boolean;
  activeLeg: ActiveLeg | null;
  commitment: Commitment | null;
  pendingAdoption?: PendingAdoption | null;
  /** Trip/order IDs to never prompt as external (agent-booked or user-dismissed) */
  suppressedExternalBookings?: string[];
  /** Set when driver arms a campaign via Telegram; extension only books matching session */
  campaignSessionId?: string | null;
  /** Pinned Telegram campaign status message (edited in place) */
  campaignStatusPin?: import("./agent-status.js").CampaignStatusPin;
  /** Extension-reported agent activity */
  agentStatus?: import("./agent-status.js").AgentStatus;
  /** Board refresh tuning — extension falls back to DEFAULT_REFRESH_POLICY when unset */
  refreshPolicy?: import("./refresh-policy.js").RefreshPolicy;
  /** Set while Relay blocks the agent (permissions, login, 2FA) — extension defers scanning */
  relayAccess?: import("./relay-access.js").RelayAccessIssue | null;
  heartbeatAt?: string;
  updatedAt: string;
}

export type OnboardingStep =
  | "subscribed"
  | "environment_ready"
  | "telegram_linked"
  | "relay_login_pending"
  | "relay_2fa_required"
  | "relay_ready"
  | "active";

export interface DriverProfile {
  userId: string;
  email: string;
  onboardingStep: OnboardingStep;
  telegramLinked: boolean;
  /** True when linked via local dev stub — real bot commands won't work until re-linked */
  telegramDevStub?: boolean;
  paused: boolean;
}
