export type SessionStep =
  | "await_relay_email"
  | "await_relay_password"
  | "campaign_more_filters"
  | "campaign_filter_destination"
  | "campaign_filter_radius"
  | "campaign_review"
  | "campaign_timing"
  | "campaign_confirm_complete"
  | "campaign_readiness"
  | "campaign_readiness_custom"
  | "handoff_readiness_custom"
  | "handoff_criteria_custom"
  | "goal_origin";

export interface CampaignDraft {
  origin: string;
  /** Same as origin = search anywhere */
  destination: string;
  minRate: number;
  minPayout: number;
  radius?: number;
}

export interface ChatSession {
  step?: SessionStep;
  userId?: string;
  relayEmail?: string;
  campaignDraft?: CampaignDraft;
  goalText?: string;
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
}
