/** Hot-path document the extension polls — see docs/data-model.md */

export type DispatchMode = "goal" | "campaign";

export type CommitmentStatus = "booked" | "picked_up" | "delivered" | "canceled";

export interface SearchCriteria {
  origin?: string;
  destination?: string;
  radius?: number;
  heading?: string;
  minRate?: number;
  minPayout?: number;
}

export interface HardRules {
  minRate?: number;
  minPayout?: number;
}

export interface ActiveLeg {
  mode: DispatchMode;
  searchCriteria: SearchCriteria;
  hardRules: HardRules;
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

export interface DispatchState {
  userId: string;
  paused: boolean;
  activeLeg: ActiveLeg | null;
  commitment: Commitment | null;
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
  paused: boolean;
}
