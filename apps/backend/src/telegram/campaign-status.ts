import type { AgentStatus, DispatchState } from "@relaybooking/shared";
import { formatCampaignStatusMessage } from "@relaybooking/shared";
import { editTelegramMessage } from "./notify";

export async function syncCampaignStatusMessage(
  userId: string,
  state: DispatchState,
  prevAgentStatus?: AgentStatus | null,
): Promise<void> {
  const pin = state.campaignStatusPin;
  if (!pin?.telegramChatId || !pin.messageId) return;

  const next = state.agentStatus;
  if (!next) return;

  const prevKey = prevAgentStatus
    ? `${prevAgentStatus.relayWorkState}:${prevAgentStatus.lastScanSummary?.at ?? ""}`
    : "";
  const nextKey = `${next.relayWorkState}:${next.lastScanSummary?.at ?? ""}`;
  if (prevKey === nextKey && prevAgentStatus?.armed === next.armed) return;

  const leg = state.activeLeg;
  const text = formatCampaignStatusMessage({
    origin: leg?.searchCriteria.origin,
    destination: leg?.searchCriteria.destination,
    armed: next.armed,
    paused: state.paused,
    commitmentLoadId: state.commitment?.loadId ?? null,
    readinessWindow: leg?.readinessWindow ?? null,
    agentStatus: next,
  });

  await editTelegramMessage(pin.telegramChatId, pin.messageId, text, [
    [{ text: "Details", callback_data: "status:details" }],
  ]);
}
