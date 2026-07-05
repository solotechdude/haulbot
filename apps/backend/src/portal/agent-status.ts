import type { Commitment, DispatchState, RelayWorkState } from "@haulbot/shared";
import { formatRouteLabel, isHuntingForQueued, relayWorkStateLabel } from "@haulbot/shared";

export interface PortalActiveTrip {
  loadId: string;
  origin: string;
  destination: string;
  routeLabel: string;
  status: string;
  payout: number | null;
  ratePerMile: number | null;
  deliveryEta: string | null;
  driverAction: string;
}

export interface PortalUpcomingLeg {
  origin: string;
  destination: string;
  routeLabel: string;
  readinessWindow: string | null;
  minRate: number | null;
  minPayout: number | null;
  phase: "queued" | "searching" | "booked";
  loadId?: string | null;
}

export interface PortalAgentStatusResponse {
  phase: string;
  phaseDetail: string | null;
  workState: RelayWorkState | null;
  running: boolean;
  paused: boolean;
  trip: PortalActiveTrip | null;
  upcomingLeg: PortalUpcomingLeg | null;
  queuedLeg: PortalUpcomingLeg | null;
  lastScan: { scanned: number; booked: boolean; at: string } | null;
  alert: "reconnect_relay" | "agent_offline" | null;
  heartbeatAt: string | null;
  updatedAt: string | null;
}

export interface BookingHistoryItem {
  loadId: string;
  origin: string;
  destination: string;
  routeLabel: string;
  payout: number | null;
  ratePerMile: number | null;
  bookedAt: string;
}

export interface BookingHistoryResponse {
  items: BookingHistoryItem[];
  totalCount: number;
  totalPayout: number;
  shownCount: number;
}

function formatReadinessShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tripFromCommitment(
  commitment: Commitment,
  booking?: { payout?: number; ratePerMile?: number } | null,
): PortalActiveTrip {
  const payout = commitment.payout ?? booking?.payout ?? null;
  const ratePerMile = commitment.ratePerMile ?? booking?.ratePerMile ?? null;
  return {
    loadId: commitment.loadId,
    origin: commitment.origin,
    destination: commitment.destination,
    routeLabel: formatRouteLabel(commitment.origin, commitment.destination),
    status: commitment.status,
    payout: payout ?? null,
    ratePerMile: ratePerMile ?? null,
    deliveryEta: commitment.deliveryEta ?? null,
    driverAction: "Assign in Relay, then tap Complete trip in Telegram when delivered.",
  };
}

function legFromCommitment(c: Commitment, phase: PortalUpcomingLeg["phase"]): PortalUpcomingLeg {
  return {
    origin: c.origin,
    destination: c.destination,
    routeLabel: formatRouteLabel(c.origin, c.destination),
    readinessWindow: c.pickupAt ?? null,
    minRate: null,
    minPayout: null,
    phase,
    loadId: c.loadId,
  };
}

function resolvePhase(state: DispatchState): { phase: string; phaseDetail: string | null } {
  if (state.relayAccess) {
    return {
      phase: "Blocked",
      phaseDetail: "Reconnect Amazon Relay — check Telegram for details.",
    };
  }

  if (state.watchdogAlert?.kind === "offline") {
    return { phase: "Offline", phaseDetail: "Extension not responding — reload it in Chrome." };
  }

  if (state.paused) {
    return { phase: "Paused", phaseDetail: "Tap Resume in Telegram to continue." };
  }

  const ws = state.agentStatus?.relayWorkState ?? "idle";
  const hunting = isHuntingForQueued(state);

  if (state.queuedCommitment && state.commitment) {
    return {
      phase: "Next load queued",
      phaseDetail: `Trip ${state.queuedCommitment.loadId} booked — complete current trip to activate.`,
    };
  }

  if (hunting) {
    const readiness = state.activeLeg?.readinessWindow ?? null;
    return {
      phase: "Searching next leg",
      phaseDetail: readiness
        ? `Hunting while on trip · pickup target ${formatReadinessShort(readiness)}`
        : "Hunting next load while current trip is active.",
    };
  }

  if (state.commitment && !state.activeLeg && !state.queuedCommitment) {
    return {
      phase: "Trip in progress",
      phaseDetail: "Complete the trip in Relay, then tap Complete trip in Telegram.",
    };
  }

  if (state.campaignSessionId && state.activeLeg) {
    return {
      phase: relayWorkStateLabel(ws),
      phaseDetail:
        ws === "scanning"
          ? "Scanning the load board for matching loads."
          : ws === "booking"
            ? "Confirming a book on Relay."
            : ws === "applying"
              ? "Applying your search filters on Relay."
              : "Agent armed — watching for loads.",
    };
  }

  return {
    phase: "Idle",
    phaseDetail: state.commitment
      ? "No next leg scheduled — use Start search in Telegram."
      : "Tap Start search in Telegram to begin.",
  };
}

function resolveSearchingLeg(state: DispatchState): PortalUpcomingLeg | null {
  if (!isHuntingForQueued(state) || !state.activeLeg) return null;
  const leg = state.activeLeg;
  const origin = leg.searchCriteria.origin ?? "?";
  const destination = leg.searchCriteria.destination ?? origin;
  return {
    origin,
    destination,
    routeLabel: formatRouteLabel(origin, destination),
    readinessWindow: leg.readinessWindow ?? leg.searchOpensAt ?? null,
    minRate: leg.hardRules.minRate ?? null,
    minPayout: leg.hardRules.minPayout ?? null,
    phase: "searching",
  };
}

function resolveQueuedLeg(state: DispatchState): PortalUpcomingLeg | null {
  if (!state.queuedCommitment) return null;
  return legFromCommitment(state.queuedCommitment, "booked");
}

export function buildPortalAgentStatus(
  state: DispatchState | null,
  bookingByLoadId: Map<string, { payout?: number; ratePerMile?: number }>,
): PortalAgentStatusResponse {
  if (!state) {
    return {
      phase: "Idle",
      phaseDetail: "Connect the extension to see live status.",
      workState: null,
      running: false,
      paused: false,
      trip: null,
      upcomingLeg: null,
      queuedLeg: null,
      lastScan: null,
      alert: null,
      heartbeatAt: null,
      updatedAt: null,
    };
  }

  const { phase, phaseDetail } = resolvePhase(state);
  const paused = state.paused ?? false;
  const running = !paused && Boolean(state.campaignSessionId && state.activeLeg);
  const scan = state.agentStatus?.lastScanSummary;

  let alert: PortalAgentStatusResponse["alert"] = null;
  if (state.relayAccess) alert = "reconnect_relay";
  else if (state.watchdogAlert?.kind === "offline") alert = "agent_offline";

  const trip = state.commitment
    ? tripFromCommitment(state.commitment, bookingByLoadId.get(state.commitment.loadId))
    : null;

  const upcomingLeg = resolveSearchingLeg(state);
  const queuedLeg = resolveQueuedLeg(state);

  return {
    phase,
    phaseDetail,
    workState: state.agentStatus?.relayWorkState ?? null,
    running,
    paused,
    trip,
    upcomingLeg,
    queuedLeg,
    lastScan: scan ? { scanned: scan.scanned, booked: scan.booked, at: scan.at } : null,
    alert,
    heartbeatAt: state.heartbeatAt ?? state.agentStatus?.updatedAt ?? null,
    updatedAt: state.updatedAt ?? null,
  };
}

export function mapBookingHistory(
  rows: Array<{
    loadId?: string;
    origin?: string;
    destination?: string;
    payout?: number;
    ratePerMile?: number;
    createdAt?: string;
  }>,
): BookingHistoryResponse {
  const items: BookingHistoryItem[] = rows
    .filter((r) => r.loadId && r.createdAt)
    .map((r) => {
      const origin = (r.origin as string) ?? "?";
      const destination = (r.destination as string) ?? "?";
      return {
        loadId: r.loadId as string,
        origin,
        destination,
        routeLabel: formatRouteLabel(origin, destination),
        payout: r.payout ?? null,
        ratePerMile: r.ratePerMile ?? null,
        bookedAt: r.createdAt as string,
      };
    });

  const totalPayout = items.reduce((sum, i) => sum + (i.payout ?? 0), 0);

  return {
    items,
    totalCount: items.length,
    totalPayout,
    shownCount: items.length,
  };
}
