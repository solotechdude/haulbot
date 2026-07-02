/** Extension load-board cycle — no overlapping apply / scan / book on one tab. */
export type RelayWorkState =
  | "idle"
  | "deferred"
  | "applying"
  | "ready"
  | "scanning"
  | "booking";

export interface LastScanSummary {
  scanned: number;
  booked: boolean;
  loadId?: string;
  reasons?: string[];
  at: string;
}

export interface AgentStatus {
  relayWorkState: RelayWorkState;
  armed: boolean;
  lastScanSummary?: LastScanSummary;
  updatedAt: string;
}

export interface CampaignStatusPin {
  telegramChatId: string;
  messageId: number;
}

export function formatRouteLabel(origin?: string, destination?: string): string {
  const o = origin ?? "?";
  const d = destination ?? "?";
  if (d.trim().toUpperCase() === o.trim().toUpperCase()) return `${o} → anywhere`;
  return `${o} → ${d}`;
}

export function relayWorkStateLabel(state: RelayWorkState): string {
  switch (state) {
    case "idle":
      return "Standing by";
    case "deferred":
      return "Waiting for pickup window";
    case "applying":
      return "Applying filters…";
    case "ready":
      return "Search ready";
    case "scanning":
      return "Scanning loads…";
    case "booking":
      return "Booking…";
  }
}

export function formatCampaignStatusMessage(input: {
  origin?: string;
  destination?: string;
  armed: boolean;
  paused?: boolean;
  commitmentLoadId?: string | null;
  readinessWindow?: string | null;
  agentStatus?: AgentStatus | null;
}): string {
  const legLine = formatRouteLabel(input.origin, input.destination);
  const lines: string[] = [`Campaign: ${legLine}`];

  if (input.commitmentLoadId) {
    lines.push(`Active trip: ${input.commitmentLoadId}`);
  } else if (input.paused) {
    lines.push("Paused");
  } else if (!input.armed) {
    lines.push("Not armed — /campaign → Book now");
  } else {
    const ws = input.agentStatus?.relayWorkState ?? "idle";
    lines.push(`Agent: ${relayWorkStateLabel(ws)}`);
    if (input.readinessWindow && new Date(input.readinessWindow).getTime() > Date.now()) {
      lines.push(`Pickup ready: ${new Date(input.readinessWindow).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`);
    }
    const scan = input.agentStatus?.lastScanSummary;
    if (scan) {
      const when = new Date(scan.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (scan.booked && scan.loadId) {
        lines.push(`Last scan (${when}): booked ${scan.loadId}`);
      } else {
        lines.push(`Last scan (${when}): ${scan.scanned} loads, no book`);
      }
    }
  }

  return lines.join("\n");
}
