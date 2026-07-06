/** Hot-path document the extension polls — see docs/data-model.md */

export type DispatchMode = "goal" | "campaign";

export type CommitmentStatus = "booked" | "picked_up" | "delivered" | "canceled";

/** Relay load board filters — what Amazon returns as search results. */
export interface SearchCriteria {
  /** Primary origin — alias for origins[0] */
  origin?: string;
  /** Up to 5 origin markets on Relay */
  origins?: string[];
  destination?: string;
  radius?: number;
  destinationRadius?: number;
  heading?: string;
  equipment?: import("./campaign.js").EquipmentSelection;
  workTypes?: string[];
  loadTypes?: string[];
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
  payout?: number;
  ratePerMile?: number;
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

/** Last-used campaign filters — origins excluded (location-specific). */
export interface LastCampaignDefaults {
  radius?: number;
  destinationRadius?: number;
  equipment?: import("./campaign.js").EquipmentSelection;
  minRate?: number;
  minPayout?: number;
  workTypes?: string[];
  loadTypes?: string[];
}

export interface SavedCampaignPreset {
  name: string;
  draft: Omit<LastCampaignDefaults, never> & {
    origins?: string[];
    destination?: string;
  };
  savedAt: string;
}

export interface DispatchState {
  userId: string;
  paused: boolean;
  activeLeg: ActiveLeg | null;
  lastCampaignDefaults?: LastCampaignDefaults;
  savedCampaignPresets?: SavedCampaignPreset[];
  commitment: Commitment | null;
  /** Next load booked while current trip is still active (max one) */
  queuedCommitment?: Commitment | null;
  /** Snapshot for re-offer after driver cancels hunt then /complete */
  canceledHunt?: ActiveLeg | null;
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
  /** When the current leg was armed — watchdog anchor for "armed but never scanned" */
  armedAt?: string;
  /** Bot-requested live status check — extension answers with a fresh page check + heartbeat ack */
  statusProbe?: { requestedAt: string } | null;
  /** requestedAt of the last probe the extension acknowledged */
  statusProbeAckedAt?: string | null;
  /** Unresolved agent-health alert raised by the backend watchdog */
  watchdogAlert?: { kind: "offline" | "scan_stalled"; at: string } | null;
  /** Pinned dashboard UI — avoid extra chat messages for confirmations */
  uiConfirmComplete?: boolean;
  uiConfirmCancelHunt?: boolean;
  uiRehuntOffer?: boolean;
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

/** Sub-phase within onboarding Step 1 ("Set up your account"). */
export type AccountSetupPhase =
  | "awaiting_subscription"
  | "provisioning"
  | "failed"
  | "complete";

export interface DriverProfile {
  userId: string;
  email: string;
  onboardingStep: OnboardingStep;
  accountSetupPhase: AccountSetupPhase;
  telegramLinked: boolean;
  paused: boolean;
}
