import type { EquipmentMain, LastCampaignDefaults } from "@haulbot/shared";

const apiOrigin = process.env.SOLO_API_ORIGIN ?? "http://localhost:8080";
const serviceToken = process.env.DISPATCHER_SERVICE_TOKEN ?? "dev-dispatcher-token";

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-service-token": serviceToken,
  };
}

async function get<T>(path: string, label: string): Promise<T> {
  const res = await fetch(`${apiOrigin}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown, label: string): Promise<T> {
  const res = await fetch(`${apiOrigin}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/** POST that surfaces 409 COMMITMENT_ACTIVE as a typed error */
async function postDispatch<T>(path: string, body: unknown, label: string): Promise<T> {
  const res = await fetch(`${apiOrigin}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const data = (await res.json()) as { commitment?: { loadId: string } };
    throw new Error(`COMMITMENT_ACTIVE:${data.commitment?.loadId ?? "unknown"}`);
  }
  if (res.status === 422) throw new Error("NEED_ORIGIN");
  if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface ActiveLegSummary {
  mode: string;
  searchCriteria: {
    origin?: string;
    origins?: string[];
    destination?: string;
    radius?: number;
    destinationRadius?: number;
    equipment?: { main: EquipmentMain; subs: string[] };
    workTypes?: string[];
    loadTypes?: string[];
  };
  hardRules: { minRate?: number; minPayout?: number };
  readinessWindow?: string;
}

export interface HandoffSummary {
  deliveryCity: string;
  draftNextLeg: {
    searchCriteria: {
      origin?: string;
      origins?: string[];
      destination?: string;
      radius?: number;
      destinationRadius?: number;
      equipment?: { main: EquipmentMain; subs: string[] };
      workTypes?: string[];
      loadTypes?: string[];
      minRate?: number;
      minPayout?: number;
    };
    hardRules: { minRate?: number; minPayout?: number };
  };
}

export interface DispatchStatus {
  profile: { onboardingStep: string };
  dispatch: {
    paused: boolean;
    activeLeg: ActiveLegSummary | null;
    commitment: { loadId: string; origin?: string; destination?: string; status?: string } | null;
    queuedCommitment?: { loadId: string; origin?: string; destination?: string } | null;
    campaignSessionId?: string | null;
    pendingAdoption?: { loadId: string } | null;
    agentStatus?: {
      relayWorkState?: string;
      lastScanSummary?: { scanned: number; booked: boolean; loadId?: string; at?: string };
    } | null;
    relayAccess?: { kind: string; detectedAt: string } | null;
    watchdogAlert?: { kind: "offline" | "scan_stalled"; at: string } | null;
    heartbeatAt?: string;
    lastCampaignDefaults?: LastCampaignDefaults | null;
  };
  handoff?: HandoffSummary | null;
  /** Set on fresh=1 requests: did the extension answer the live probe? */
  live?: "confirmed" | "unreachable" | null;
}

export async function linkTelegram(input: {
  token: string;
  telegramChatId: string;
  telegramUsername?: string;
}): Promise<{ userId: string }> {
  const res = await fetch(`${apiOrigin}/v1/bot/telegram/link`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (res.status === 401) throw new Error("INVALID_TOKEN");
  if (res.status === 409) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error === "CHAT_LINKED_TO_OTHER" ? "CHAT_LINKED_TO_OTHER" : "LINK_CONFLICT");
  }
  if (!res.ok) throw new Error(`link failed: ${res.status}`);
  return res.json() as Promise<{ userId: string }>;
}

export async function getUserIdByChat(chatId: string): Promise<string | null> {
  const res = await fetch(`${apiOrigin}/v1/bot/user-by-chat/${encodeURIComponent(chatId)}`, {
    headers: headers(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`user lookup failed: ${res.status}`);
  const data = (await res.json()) as { userId: string };
  return data.userId;
}

export async function storeRelayCredentials(
  userId: string,
  email: string,
  password: string,
): Promise<{ require2fa: boolean }> {
  return post("/v1/bot/relay/credentials", { userId, email, password }, "credentials");
}

export async function storeRelay2fa(userId: string, code: string): Promise<void> {
  await post("/v1/bot/relay/2fa", { userId, code }, "2fa");
}

export async function checkBackendHealth(): Promise<void> {
  const res = await fetch(`${apiOrigin}/health`);
  if (!res.ok) throw new Error(`Backend unhealthy: ${res.status}`);
}

export async function setCampaign(
  userId: string,
  input: {
    origin: string;
    origins?: string[];
    destination: string;
    minRate: number;
    minPayout: number;
    radius?: number;
    destinationRadius?: number;
    equipment?: { main: EquipmentMain; subs: string[] };
    workTypes?: string[];
    loadTypes?: string[];
    readinessWindow?: string;
    clearCommitment?: boolean;
  },
): Promise<{ activeLeg: ActiveLegSummary }> {
  return postDispatch("/v1/bot/dispatch/campaign", { userId, ...input }, "campaign");
}

export async function saveCampaignPreset(
  userId: string,
  name: string,
  draft: {
    origins: string[];
    destination: string;
    minRate: number;
    minPayout: number;
    radius?: number;
    destinationRadius?: number;
    equipment?: { main: EquipmentMain; subs: string[] };
    workTypes?: string[];
    loadTypes?: string[];
  },
): Promise<void> {
  await post("/v1/bot/dispatch/campaign/preset", { userId, name, draft }, "preset");
}

export interface GoalResponse {
  activeLeg: ActiveLegSummary;
  goal: {
    revenueTarget?: number;
    deadline?: string;
    destinationCity?: string;
    dailyTarget?: number;
  };
}

export async function setGoal(
  userId: string,
  text: string,
  origin?: string,
): Promise<GoalResponse> {
  return postDispatch("/v1/bot/dispatch/goal", { userId, text, origin }, "goal");
}

export async function completeCommitment(userId: string, loadId?: string): Promise<string> {
  const data = await post<{ clearedLoadId: string }>(
    "/v1/bot/dispatch/complete",
    { userId, loadId },
    "complete",
  );
  return data.clearedLoadId;
}

export async function setCampaignStatusPin(
  userId: string,
  telegramChatId: string,
  messageId: number,
): Promise<void> {
  await post(
    "/v1/bot/dispatch/campaign-status-pin",
    { userId, telegramChatId, messageId },
    "campaign-status-pin",
  );
}

export async function adoptPendingBooking(userId: string, loadId?: string): Promise<string> {
  const data = await post<{ loadId: string }>("/v1/bot/dispatch/adopt", { userId, loadId }, "adopt");
  return data.loadId;
}

export async function dismissPendingAdoption(userId: string): Promise<void> {
  await post("/v1/bot/dispatch/dismiss-adoption", { userId }, "dismiss");
}

export async function completeHandoff(
  userId: string,
  readinessWindow: string,
): Promise<{ activeLeg: ActiveLegSummary; readinessWindow: string }> {
  return post("/v1/bot/dispatch/handoff/complete", { userId, readinessWindow }, "handoff");
}

export async function dismissHandoff(userId: string): Promise<void> {
  await post("/v1/bot/dispatch/handoff/dismiss", { userId }, "handoff dismiss");
}

export async function updateHandoffDraft(
  userId: string,
  input: { origin?: string; destination?: string; minRate?: number; minPayout?: number },
): Promise<{ handoff: HandoffSummary }> {
  return post("/v1/bot/dispatch/handoff/draft", { userId, ...input }, "handoff draft");
}

/**
 * fresh=true asks the backend to probe the extension for a live load board
 * check before answering — can take up to ~25s while the agent verifies.
 */
export async function getDispatchStatus(
  userId: string,
  options: { fresh?: boolean } = {},
): Promise<DispatchStatus> {
  const query = options.fresh ? "?fresh=1" : "";
  return get(`/v1/bot/dispatch/status/${encodeURIComponent(userId)}${query}`, "status");
}

export async function syncDispatchUi(userId: string): Promise<void> {
  await post("/v1/bot/dispatch/sync-ui", { userId }, "sync-ui");
}

export async function promptCompleteConfirm(userId: string): Promise<void> {
  await post("/v1/bot/dispatch/ui/complete-prompt", { userId }, "complete-prompt");
}

export async function promptCancelHunt(userId: string): Promise<void> {
  await post("/v1/bot/dispatch/ui/cancel-hunt-prompt", { userId }, "cancel-hunt-prompt");
}

export async function clearDashboardPrompts(userId: string): Promise<void> {
  await post("/v1/bot/dispatch/ui/clear-prompts", { userId }, "clear-prompts");
}

export async function shiftHuntPickup(
  userId: string,
  hours: number,
): Promise<{ readinessWindow: string }> {
  return post("/v1/bot/dispatch/hunt/shift", { userId, hours }, "hunt shift");
}

export async function shiftHuntPickupTo(
  userId: string,
  readinessWindow: string,
): Promise<{ readinessWindow: string }> {
  return post("/v1/bot/dispatch/hunt/shift", { userId, readinessWindow }, "hunt shift");
}

export async function cancelHunt(userId: string): Promise<void> {
  await post("/v1/bot/dispatch/hunt/cancel", { userId }, "hunt cancel");
}

export async function rehunt(
  userId: string,
  accept: boolean,
): Promise<{ armed: boolean; readinessWindow?: string }> {
  return post("/v1/bot/dispatch/rehunt", { userId, accept }, "rehunt");
}

export async function setPaused(userId: string, paused: boolean): Promise<void> {
  const path = paused ? "pause" : "resume";
  await post(`/v1/bot/dispatch/${path}`, { userId }, path);
}
