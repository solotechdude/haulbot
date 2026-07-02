const apiOrigin = process.env.SOLO_API_ORIGIN ?? "http://localhost:8080";
const serviceToken = process.env.DISPATCHER_SERVICE_TOKEN ?? "dev-dispatcher-token";

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-service-token": serviceToken,
  };
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
  if (!res.ok) throw new Error(`link failed: ${res.status}`);
  return res.json() as Promise<{ ok: true; userId: string }>;
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
  const res = await fetch(`${apiOrigin}/v1/bot/relay/credentials`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, email, password }),
  });
  if (!res.ok) throw new Error(`credentials failed: ${res.status}`);
  return res.json() as Promise<{ ok: true; require2fa: boolean }>;
}

export async function storeRelay2fa(userId: string, code: string): Promise<void> {
  const res = await fetch(`${apiOrigin}/v1/bot/relay/2fa`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, code }),
  });
  if (!res.ok) throw new Error(`2fa failed: ${res.status}`);
}

export async function checkBackendHealth(): Promise<void> {
  const res = await fetch(`${apiOrigin}/health`);
  if (!res.ok) throw new Error(`Backend unhealthy: ${res.status}`);
}

export async function setCampaign(
  userId: string,
  input: {
    origin: string;
    destination: string;
    minRate: number;
    minPayout: number;
    radius?: number;
    readinessWindow?: string;
    clearCommitment?: boolean;
  },
): Promise<{ activeLeg: { mode: string; searchCriteria: Record<string, unknown>; hardRules: Record<string, unknown>; readinessWindow?: string } }> {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/campaign`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, ...input }),
  });
  if (res.status === 409) {
    const data = (await res.json()) as { commitment?: { loadId: string } };
    throw new Error(`COMMITMENT_ACTIVE:${data.commitment?.loadId ?? "unknown"}`);
  }
  if (!res.ok) throw new Error(`campaign failed: ${res.status}`);
  return res.json() as Promise<{ ok: true; activeLeg: { mode: string; searchCriteria: Record<string, unknown>; hardRules: Record<string, unknown>; readinessWindow?: string } }>;
}

export async function completeCommitment(userId: string, loadId?: string): Promise<string> {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/complete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, loadId }),
  });
  if (!res.ok) throw new Error(`complete failed: ${res.status}`);
  const data = (await res.json()) as { clearedLoadId: string };
  return data.clearedLoadId;
}

export async function setCampaignStatusPin(
  userId: string,
  telegramChatId: string,
  messageId: number,
): Promise<void> {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/campaign-status-pin`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, telegramChatId, messageId }),
  });
  if (!res.ok) throw new Error(`campaign-status-pin failed: ${res.status}`);
}

export async function adoptPendingBooking(userId: string, loadId?: string): Promise<string> {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/adopt`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, loadId }),
  });
  if (!res.ok) throw new Error(`adopt failed: ${res.status}`);
  const data = (await res.json()) as { loadId: string };
  return data.loadId;
}

export async function dismissPendingAdoption(userId: string): Promise<void> {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/dismiss-adoption`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`dismiss failed: ${res.status}`);
}

export async function completeHandoff(userId: string, readinessWindow: string) {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/handoff/complete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, readinessWindow }),
  });
  if (!res.ok) throw new Error(`handoff failed: ${res.status}`);
  return res.json() as Promise<{
    ok: true;
    activeLeg: {
      mode: string;
      searchCriteria: { origin?: string; destination?: string };
      hardRules: { minRate?: number; minPayout?: number };
      readinessWindow?: string;
    };
    readinessWindow: string;
  }>;
}

export async function dismissHandoff(userId: string): Promise<void> {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/handoff/dismiss`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`handoff dismiss failed: ${res.status}`);
}

export async function updateHandoffDraft(
  userId: string,
  input: { origin?: string; destination?: string; minRate?: number; minPayout?: number },
) {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/handoff/draft`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId, ...input }),
  });
  if (!res.ok) throw new Error(`handoff draft failed: ${res.status}`);
  return res.json() as Promise<{
    ok: true;
    handoff: {
      deliveryCity: string;
      draftNextLeg: {
        searchCriteria: { origin?: string; destination?: string; minRate?: number; minPayout?: number };
        hardRules: { minRate?: number; minPayout?: number };
      };
    };
  }>;
}

export async function getDispatchStatus(userId: string) {
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/status/${encodeURIComponent(userId)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`status failed: ${res.status}`);
  return res.json() as Promise<{
    profile: { onboardingStep: string };
    dispatch: {
      paused: boolean;
      activeLeg: {
        mode: string;
        searchCriteria: { origin?: string; destination?: string };
        readinessWindow?: string;
      } | null;
      commitment: { loadId: string; origin?: string; destination?: string; status?: string } | null;
      campaignSessionId?: string | null;
    };
    handoff?: {
      deliveryCity: string;
      draftNextLeg: {
        searchCriteria: { origin?: string; destination?: string; minRate?: number; minPayout?: number };
        hardRules: { minRate?: number; minPayout?: number };
      };
    } | null;
  }>;
}

export async function setPaused(userId: string, paused: boolean): Promise<void> {
  const path = paused ? "pause" : "resume";
  const res = await fetch(`${apiOrigin}/v1/bot/dispatch/${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
}
