import type { EquipmentMain, EquipmentSelection } from "@haulbot/shared";

export type WizardStepId =
  | "origin"
  | "radius"
  | "equipment_main"
  | "equipment_subs"
  | "rate"
  | "payout"
  | "optional"
  | "optional_dest"
  | "optional_dest_radius"
  | "optional_pickup"
  | "optional_work"
  | "optional_load"
  | "review"
  | "edit"
  | "timing"
  | "readiness"
  | "confirm_complete";

export type SessionStep =
  | "await_relay_email"
  | "await_relay_password"
  | "cw_origin_text"
  | "cw_dest_text"
  | "cw_rate_text"
  | "cw_payout_text"
  | "cw_radius_text"
  | "cw_dest_radius_text"
  | "cw_readiness_custom"
  | "cw_preset_name"
  | "handoff_readiness_custom"
  | "handoff_criteria_custom"
  | "hunt_readiness_custom"
  | "goal_origin";

export interface CampaignDraft {
  origins: string[];
  /** Same as first origin = anywhere */
  destination: string;
  minRate: number;
  minPayout: number;
  radius?: number;
  destinationRadius?: number;
  equipment?: EquipmentSelection;
  workTypes?: string[];
  loadTypes?: string[];
  readinessWindow?: string;
}

export interface ChatSession {
  step?: SessionStep;
  userId?: string;
  relayEmail?: string;
  campaignDraft?: CampaignDraft;
  goalText?: string;
  /** Wizard navigation stack for Back */
  wizardStack?: WizardStepId[];
  /** Return to review after editing a field */
  wizardEditMode?: boolean;
  /** Preset name being saved */
  presetName?: string;
  /** Relay market city from Mini App GPS for this search only */
  detectedOriginToken?: string;
  /** Single wizard message — steps edit in place to reduce chat clutter */
  wizardMessageId?: number;
}

const sessions = new Map<string, ChatSession>();

export function getSession(chatId: number): ChatSession {
  const key = String(chatId);
  if (!sessions.has(key)) sessions.set(key, {});
  return sessions.get(key)!;
}

export function clearSession(chatId: number): void {
  sessions.delete(String(chatId));
}

export function clearCampaignSession(chatId: number): void {
  const s = getSession(chatId);
  delete s.step;
  delete s.campaignDraft;
  delete s.wizardStack;
  delete s.wizardEditMode;
  delete s.presetName;
  delete s.detectedOriginToken;
  delete s.wizardMessageId;
}

export function emptyCampaignDraft(): CampaignDraft {
  return {
    origins: [],
    destination: "",
    minRate: 0,
    minPayout: 0,
    equipment: { main: "tractor_trailer", subs: ["All", "53' Trailer"] },
  };
}

export function draftOrigin(draft: CampaignDraft): string {
  return draft.origins[0] ?? "";
}

export function syncDraftOriginAlias(draft: CampaignDraft): void {
  if (draft.origins.length > 0 && !draft.destination) {
    draft.destination = draft.origins[0]!;
  }
}

export function isAnywhereDestination(draft: CampaignDraft): boolean {
  const o = draftOrigin(draft);
  return !o || draft.destination.toUpperCase() === o.toUpperCase();
}
