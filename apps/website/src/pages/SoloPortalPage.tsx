import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SUBSCRIPTION_PRICE_USD, LEGAL_ENTITY, type AccountSetupPhase, type DriverProfile, type OnboardingStep } from "@haulbot/shared";
import { trackOnce } from "../analytics/gtag";
import { SiteLayout } from "../components/SiteLayout";
import { TelegramConnectPanel } from "../components/TelegramConnectPanel";
import { Button } from "../components/ui/Button";
import "../components/ui/Button.css";
import "./SoloPortalPage.css";

const DEV_USER_ID = "dev-user-1";
const SESSION_KEY = "haulbot_user_id";
const SESSION_TOKEN_KEY = "haulbot_session_token";

const STEP_ORDER: OnboardingStep[] = [
  "subscribed",
  "environment_ready",
  "telegram_linked",
  "relay_login_pending",
  "relay_2fa_required",
  "relay_ready",
  "active",
];

const STEP_HINTS: Record<string, string> = {
  telegram: "Link Telegram to control dispatch and receive booking updates on the road.",
  relay: "Send your Amazon Relay credentials in Telegram so the agent can sign in and book.",
  dispatch: "Once Relay is linked, set your first campaign in Telegram to start dispatch.",
};

function accountStepSubtitle(phase: AccountSetupPhase): string {
  switch (phase) {
    case "awaiting_subscription":
      return "Confirming your subscription…";
    case "provisioning":
      return "Setting up your dispatch environment…";
    case "failed":
      return "Environment setup needs attention";
    default:
      return "Setting up your account…";
  }
}

function AccountSetupSubsteps({ phase }: { phase: AccountSetupPhase }) {
  const paymentDone = phase !== "awaiting_subscription";
  const envDone = phase === "complete";
  const envFailed = phase === "failed";
  const envActive = phase === "provisioning";

  return (
    <ul className="portal__account-substeps">
      <li
        className={`portal__account-substep${
          paymentDone ? " portal__account-substep--done" : " portal__account-substep--active"
        }`}
      >
        <span className="portal__account-substep-marker" aria-hidden="true">
          {paymentDone ? <CheckIcon /> : <span className="portal__account-spinner" />}
        </span>
        <span className="portal__account-substep-label">
          {paymentDone ? "Payment confirmed" : "Confirming payment"}
        </span>
      </li>
      <li
        className={`portal__account-substep${
          envDone
            ? " portal__account-substep--done"
            : envFailed
              ? " portal__account-substep--failed"
              : envActive
                ? " portal__account-substep--active"
                : ""
        }`}
      >
        <span className="portal__account-substep-marker" aria-hidden="true">
          {envDone ? (
            <CheckIcon />
          ) : envFailed ? (
            "!"
          ) : (
            <span className="portal__account-spinner" />
          )}
        </span>
        <span className="portal__account-substep-label">
          {envDone
            ? "Dispatch environment ready"
            : envFailed
              ? "Environment setup failed"
              : "Setting up your dispatch environment"}
        </span>
      </li>
    </ul>
  );
}

type StepStatus = "done" | "current" | "upcoming";

interface PortalActiveTrip {
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

interface PortalUpcomingLeg {
  origin: string;
  destination: string;
  routeLabel: string;
  readinessWindow: string | null;
  minRate: number | null;
  minPayout: number | null;
  phase: "queued" | "armed" | "searching" | "booked";
  loadId?: string | null;
}

interface AgentStatus {
  phase: string;
  phaseDetail: string | null;
  workState: string | null;
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

interface BookingHistoryItem {
  loadId: string;
  routeLabel: string;
  payout: number | null;
  ratePerMile: number | null;
  bookedAt: string;
}

interface BookingHistory {
  items: BookingHistoryItem[];
  totalCount: number;
  totalPayout: number;
  shownCount: number;
}

type HistoryPeriod = "week" | "month" | "all";

type BillingSummary =
  | { status: "none" }
  | {
      plan: string;
      status: "active" | "past_due" | "canceled";
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    };

const TELEGRAM_BOT_URL = `https://t.me/${
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "agent_haulbot"
}`;

function statusOf(done: boolean, current: boolean): StepStatus {
  if (done) return "done";
  if (current) return "current";
  return "upcoming";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatCompactEta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTripStatus(status: string): string {
  return status.replace(/_/g, " ");
}

type AgentPillState = "blocked" | "offline" | "paused" | "running" | "idle" | "working" | "queued";

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function resolveAgentPill(status: AgentStatus | null): { label: string; state: AgentPillState } {
  if (status?.alert === "reconnect_relay") return { label: "Blocked", state: "blocked" };
  if (status?.alert === "agent_offline") return { label: "Offline", state: "offline" };
  if (status?.paused) return { label: "Paused", state: "paused" };
  if (status?.phase === "Next load queued" || status?.phase === "Searching next leg") {
    return { label: status.phase, state: "queued" };
  }
  if (status?.phase === "Next leg queued" || status?.phase === "Scheduled") {
    return { label: status.phase, state: "queued" };
  }
  if (status?.running) return { label: status.phase, state: "running" };
  if (
    status?.phase &&
    !["Idle", "Trip in progress", "Next leg queued", "Scheduled"].includes(status.phase)
  ) {
    return { label: status.phase, state: "working" };
  }
  if (status?.phase === "Trip in progress") {
    return { label: status.phase, state: "queued" };
  }
  return { label: status?.phase ?? "Idle", state: "idle" };
}

function openTelegram() {
  window.open(TELEGRAM_BOT_URL, "_blank", "noopener");
}

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Never connected";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const diffMs = Date.now() - at.getTime();
  if (diffMs < 60_000) return "Just now";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLastScanValue(scan: { scanned: number; booked: boolean; at: string }): ReactNode {
  const time = formatTime(scan.at);
  if (scan.booked) {
    return (
      <>
        {time} · <span className="portal__scan-booked">booked</span>
      </>
    );
  }
  return `${time} · ${scan.scanned} loads · no match`;
}

function resolveInitialUserId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) return null;
  return localStorage.getItem(SESSION_KEY) ?? (import.meta.env.DEV ? DEV_USER_ID : null);
}

async function verifyToken(token: string): Promise<string> {
  const res = await fetch(`/api/auth/magic-link?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error("Invalid or expired link");
  const data = (await res.json()) as { userId: string; sessionToken?: string };
  if (data.sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
  return data.userId;
}

/** Bearer session token when present; x-user-id works only against dev backends */
function authHeaders(userId: string): HeadersInit {
  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
  if (sessionToken) return { Authorization: `Bearer ${sessionToken}` };
  return { "x-user-id": userId };
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="portal__external-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 3.5H12.5V9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 3.5L3.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TelegramButton({
  variant,
  className,
}: {
  variant: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Button variant={variant} className={className} onClick={openTelegram}>
      <span className="portal__btn-label-full">Open in Telegram</span>
      <span className="portal__btn-label-short">Telegram</span>
      <ExternalLinkIcon />
    </Button>
  );
}

export function SoloPortalPage() {
  const [userId, setUserId] = useState<string | null>(resolveInitialUserId);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [bookingHistory, setBookingHistory] = useState<BookingHistory | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("week");
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoadFailed, setBillingLoadFailed] = useState(false);
  const [provisionRetrying, setProvisionRetrying] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const checkoutSuccess = params.get("checkout") === "success";
  const tokenExchanged = useRef(false);
  const lastTrackedStep = useRef<string | null>(null);

  const loadProfile = useCallback(async (id: string) => {
    const res = await fetch("/api/onboarding/status", {
      headers: authHeaders(id),
    });
    if (!res.ok) throw new Error(res.status === 404 ? "No account yet" : "Failed to load profile");
    return res.json() as Promise<DriverProfile>;
  }, []);

  useEffect(() => {
    const token = params.get("token");
    if (!token || tokenExchanged.current) return;
    // Single-use tokens must be exchanged exactly once — guard against
    // StrictMode's double-invoked effects consuming (and burning) the token twice.
    tokenExchanged.current = true;

    verifyToken(token)
      .then((id) => {
        localStorage.setItem(SESSION_KEY, id);
        setUserId(id);
        window.history.replaceState({}, "", "/solo");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!checkoutSuccess) return;
    trackOnce("purchase", "purchase", { value: SUBSCRIPTION_PRICE_USD, currency: "USD" });
    trackOnce("sign_up", "sign_up", { method: "stripe_checkout" });
  }, [checkoutSuccess]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    const poll = () => {
      loadProfile(userId)
        .then((p) => {
          if (!active) return;
          setProfile(p);

          const currentStep = p.onboardingStep;
          const lastStep = lastTrackedStep.current;
          const currentIndex = STEP_ORDER.indexOf(currentStep);
          const lastIndex = lastStep ? STEP_ORDER.indexOf(lastStep as OnboardingStep) : -1;
          if (currentIndex > lastIndex) {
            if (currentStep === "telegram_linked" || currentStep === "relay_ready") {
              trackOnce(`onboarding_${currentStep}`, "onboarding_step", { step: currentStep });
              lastTrackedStep.current = currentStep;
            } else if (currentStep === "active") {
              trackOnce("onboarding_complete", "onboarding_complete");
              lastTrackedStep.current = currentStep;
            }
          }

          if (p.onboardingStep === "active") {
            fetch("/api/onboarding/agent-status", { headers: authHeaders(userId) })
              .then((res) =>
                res.ok ? res.json() : Promise.reject(new Error("agent-status failed")),
              )
              .then((s: AgentStatus) => {
                if (active) setAgentStatus(s);
              })
              .catch(() => {
                /* keep last known status */
              });
          } else {
            setAgentStatus(null);
          }
        })
        .catch((err: Error) => {
          if (active) setError(err.message);
        });
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId, loadProfile]);

  useEffect(() => {
    if (!userId || profile?.onboardingStep !== "active") return;

    let active = true;
    fetch(`/api/onboarding/booking-history?period=${historyPeriod}&limit=20`, {
      headers: authHeaders(userId),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("history failed"))))
      .then((data: BookingHistory) => {
        if (active) setBookingHistory(data);
      })
      .catch(() => {
        /* keep last known */
      });

    return () => {
      active = false;
    };
  }, [userId, profile?.onboardingStep, historyPeriod]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    fetch("/api/billing/summary", { headers: authHeaders(userId) })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("billing failed"))))
      .then((data: BillingSummary) => {
        if (active) {
          setBilling(data);
          setBillingLoadFailed(false);
        }
      })
      .catch(() => {
        if (active) setBillingLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function retryProvision() {
    if (!userId) return;
    setProvisionRetrying(true);
    try {
      const res = await fetch("/api/onboarding/retry-provision", {
        method: "POST",
        headers: authHeaders(userId),
      });
      if (!res.ok) throw new Error("Retry failed");
      const p = (await res.json()) as DriverProfile;
      setProfile(p);
    } catch {
      /* next poll will refresh */
    } finally {
      setProvisionRetrying(false);
    }
  }

  async function openBillingPortal() {
    if (!userId) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/portal-session", {
        method: "POST",
        headers: authHeaders(userId),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        if (res.status === 400 || data.error === "NO_CUSTOMER") {
          setBillingError("No billing account found.");
        } else {
          setBillingError("Billing isn't available right now.");
        }
        setBillingLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setBillingError("Billing isn't available right now.");
        setBillingLoading(false);
      }
    } catch {
      setBillingError("Billing isn't available right now.");
      setBillingLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    window.location.href = "/";
  }

  const step = profile?.onboardingStep;
  const stepIndex = step ? STEP_ORDER.indexOf(step) : -1;
  const isComplete = step === "active";

  const telegramConnected = Boolean(profile?.telegramLinked);
  const relayConnected = step === "relay_ready" || step === "active";

  const agentPill = resolveAgentPill(agentStatus);
  const agentAlertMessage =
    agentStatus?.alert === "reconnect_relay"
      ? "Reconnect Amazon Relay in Telegram"
      : agentStatus?.alert === "agent_offline"
        ? "Agent offline — open Telegram to check"
        : null;
  const agentAlertKind = agentStatus?.alert ?? null;
  const lastSeenAt = agentStatus?.heartbeatAt ?? agentStatus?.updatedAt ?? null;
  const agentStatusDetail =
    agentStatus?.queuedLeg && agentStatus?.trip
      ? "Complete current trip in Telegram to activate the queued load."
      : agentStatus?.upcomingLeg?.phase === "searching" && agentStatus?.trip
        ? "Agent is searching for your next load while you run the current trip."
        : agentStatus?.phaseDetail;

  const checklist = profile
    ? [
        {
          key: "account",
          title: "Set up your account",
          status: statusOf(stepIndex > 0, step === "subscribed"),
        },
        {
          key: "telegram",
          title: "Connect Telegram",
          status: statusOf(telegramConnected, step === "environment_ready"),
        },
        {
          key: "relay",
          title: "Link Amazon Relay",
          status: statusOf(
            step === "relay_ready" || step === "active",
            step === "telegram_linked" ||
              step === "relay_login_pending" ||
              step === "relay_2fa_required",
          ),
        },
        {
          key: "dispatch",
          title: "Ready to dispatch",
          status: statusOf(step === "active", step === "relay_ready"),
        },
      ]
    : [];

  const completedSteps = checklist.filter((item) => item.status === "done").length;
  const progressPct = checklist.length ? Math.round((completedSteps / checklist.length) * 100) : 0;

  function renderStepAction(key: string, status: StepStatus) {
    if (status !== "current") return null;

    if (key === "account" && profile) {
      const phase = profile.accountSetupPhase;

      if (phase === "failed") {
        return (
          <div className="portal__stepper-actions portal__stepper-actions--account">
            <p className="portal__stepper-hint portal__stepper-hint--error">
              We couldn&apos;t finish setting up your dedicated dispatch environment. Try again, or
              contact{" "}
              <a href={`mailto:${LEGAL_ENTITY.supportEmail}`}>{LEGAL_ENTITY.supportEmail}</a> if this
              keeps happening.
            </p>
            <Button variant="primary" onClick={() => void retryProvision()} disabled={provisionRetrying}>
              {provisionRetrying ? "Retrying…" : "Try again"}
            </Button>
          </div>
        );
      }

      return (
        <div className="portal__stepper-actions portal__stepper-actions--account">
          <AccountSetupSubsteps phase={phase} />
          {phase === "awaiting_subscription" ? (
            <p className="portal__stepper-hint">
              We&apos;re confirming your subscription. This page will update automatically.
            </p>
          ) : (
            <>
              <p className="portal__stepper-hint">
                This usually takes 1–3 minutes. Nothing for you to do right now.
              </p>
              <p className="portal__stepper-hint portal__stepper-hint--muted">
                This page updates automatically. You can close this tab — we&apos;ll email you when
                Step 2 is ready.
              </p>
            </>
          )}
        </div>
      );
    }

    if (key === "telegram") {
      return (
        <div className="portal__stepper-actions portal__stepper-actions--telegram">
          {userId ? (
            <TelegramConnectPanel userId={userId} />
          ) : null}
        </div>
      );
    }

    if (key === "relay") {
      return (
        <div className="portal__stepper-actions portal__stepper-actions--hint">
          <p className="portal__stepper-command">
            In Telegram, send{" "}
            <code className="portal__code">
              {step === "relay_2fa_required" ? "/2fa YOUR_CODE" : "/connect_relay"}
            </code>
          </p>
          <Button variant="secondary" onClick={openTelegram}>
            Open Telegram
          </Button>
        </div>
      );
    }

    return null;
  }

  return (
    <SiteLayout mainClassName="site__main--portal">
      <div className="portal">
        {checkoutSuccess && !error ? (
          <p className="portal__banner">Payment received. Complete onboarding below.</p>
        ) : null}

        {error ? (
          <div className="portal__card">
            <p className="portal__message">
              {error}. Use the link from your checkout email or contact support.
            </p>
          </div>
        ) : !userId ? (
          <div className="portal__card">
            <p className="portal__message">Verifying your secure link…</p>
          </div>
        ) : !profile ? (
          <div className="portal__card">
            <p className="portal__message">Loading…</p>
          </div>
        ) : (
          <>
            {isComplete ? (
              <section className="portal__card portal__card--agent">
                <div className="portal__agent-head">
                  <p className="portal__eyebrow portal__eyebrow--flush">
                    <span className="portal__eyebrow-tick" />
                    Agent status
                  </p>
                  <TelegramButton variant="secondary" className="portal__agent-cta portal__agent-cta--head" />
                </div>

                {agentAlertKind && agentAlertMessage ? (
                  <div
                    className={`portal__agent-status portal__agent-status--${agentAlertKind === "reconnect_relay" ? "blocked" : "offline"}`}
                    role="status"
                  >
                    <span className="portal__agent-status-dot" aria-hidden="true" />
                    <div className="portal__agent-status-copy">
                      <span className="portal__agent-status-label">{agentPill.label}</span>
                      <p className="portal__agent-status-detail">{agentAlertMessage}</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`portal__agent-status portal__agent-status--${agentPill.state}`}
                    role="status"
                  >
                    <span className="portal__agent-status-dot" aria-hidden="true" />
                    <div className="portal__agent-status-copy">
                      <span className="portal__agent-status-label">{agentPill.label}</span>
                      {agentStatusDetail ? (
                        <p className="portal__agent-status-detail">{agentStatusDetail}</p>
                      ) : null}
                    </div>
                  </div>
                )}

                {agentStatus?.trip || agentStatus?.upcomingLeg || agentStatus?.queuedLeg ? (
                  <div
                    className={`portal__agent-grid${
                      [agentStatus?.trip, agentStatus?.upcomingLeg, agentStatus?.queuedLeg].filter(Boolean)
                        .length > 1
                        ? " portal__agent-grid--dual"
                        : ""
                    }`}
                  >
                    {agentStatus?.trip ? (
                      <article className="portal__load-panel">
                        <span className="portal__panel-label">Current load</span>
                        <p className="portal__panel-route">{agentStatus.trip.routeLabel}</p>
                        <p className="portal__panel-meta">
                          {formatMoney(agentStatus.trip.payout)}
                          {agentStatus.trip.ratePerMile != null
                            ? ` · $${agentStatus.trip.ratePerMile}/mi`
                            : ""}
                          {" · "}
                          <span className="portal__panel-status">
                            {formatTripStatus(agentStatus.trip.status)}
                          </span>
                        </p>
                        <p className="portal__panel-sub">{agentStatus.trip.loadId}</p>
                        <p className="portal__panel-hint">{agentStatus.trip.driverAction}</p>
                      </article>
                    ) : null}

                    {agentStatus?.upcomingLeg ? (
                      <article className="portal__load-panel portal__load-panel--next">
                        <span className="portal__panel-label">Searching</span>
                        <p className="portal__panel-route">{agentStatus.upcomingLeg.routeLabel}</p>
                        <p className="portal__panel-meta">
                          {agentStatus.upcomingLeg.minRate != null &&
                          agentStatus.upcomingLeg.minPayout != null
                            ? `$${agentStatus.upcomingLeg.minRate}/mi min · $${agentStatus.upcomingLeg.minPayout} min`
                            : null}
                          {agentStatus.upcomingLeg.readinessWindow
                            ? `${agentStatus.upcomingLeg.minRate != null ? " · " : ""}Pickup ${formatCompactEta(agentStatus.upcomingLeg.readinessWindow)}`
                            : null}
                        </p>
                        <p className="portal__panel-hint portal__panel-hint--muted">
                          Hunting next load while current trip is active.
                        </p>
                      </article>
                    ) : null}

                    {agentStatus?.queuedLeg ? (
                      <article className="portal__load-panel portal__load-panel--next">
                        <span className="portal__panel-label">Queued</span>
                        <p className="portal__panel-route">{agentStatus.queuedLeg.routeLabel}</p>
                        <p className="portal__panel-meta">
                          {agentStatus.queuedLeg.loadId ? `Trip ${agentStatus.queuedLeg.loadId}` : null}
                          {agentStatus.queuedLeg.readinessWindow
                            ? ` · Pickup ${formatCompactEta(agentStatus.queuedLeg.readinessWindow)}`
                            : null}
                        </p>
                        <p className="portal__panel-hint portal__panel-hint--muted">
                          Complete current trip in Telegram to activate.
                        </p>
                      </article>
                    ) : null}
                  </div>
                ) : null}

                <footer className="portal__agent-foot">
                  <span className="portal__agent-foot-item">
                    <span className="portal__agent-foot-key">Last scan</span>
                    {agentStatus?.lastScan ? (
                      formatLastScanValue(agentStatus.lastScan)
                    ) : (
                      <span className="portal__agent-foot-muted">None</span>
                    )}
                  </span>
                  <span className="portal__agent-foot-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="portal__agent-foot-item">
                    <span className="portal__agent-foot-key">Last seen</span>
                    {formatLastSeen(lastSeenAt)}
                  </span>
                </footer>
              </section>
            ) : (
              <section className="portal__card portal__card--feature portal__onboarding" aria-label="Get started">
                <p className="portal__eyebrow">
                  <span className="portal__eyebrow-tick" />
                  Get started
                </p>
                <div className="portal__onboarding-head">
                  {step === "subscribed" && profile ? (
                    <p className="portal__onboarding-phase">
                      Step 1 of {checklist.length} — {accountStepSubtitle(profile.accountSetupPhase)}
                    </p>
                  ) : null}
                  <p className="portal__onboarding-meta">
                    {completedSteps} of {checklist.length} complete
                  </p>
                  <div
                    className="portal__progress"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Onboarding progress"
                  >
                    <span className="portal__progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <ol className="portal__stepper">
                  {checklist.map((item, index) => (
                    <li
                      key={item.key}
                      className={`portal__stepper-item portal__stepper-item--${item.status}`}
                      aria-current={item.status === "current" ? "step" : undefined}
                    >
                      <div className="portal__stepper-rail" aria-hidden="true">
                        <span className={`portal__stepper-marker portal__stepper-marker--${item.status}`}>
                          {item.status === "done" ? <CheckIcon /> : index + 1}
                        </span>
                      </div>
                      <div className="portal__stepper-body">
                        <p className="portal__stepper-title">{item.title}</p>
                        {item.status === "done" ? (
                          <p className="portal__stepper-status portal__stepper-status--done">Complete</p>
                        ) : null}
                        {item.status === "upcoming" ? (
                          <p className="portal__stepper-status portal__stepper-status--upcoming">Up next</p>
                        ) : null}
                        {item.status === "current" ? (
                          <div
                            className={`portal__stepper-panel${
                              item.key === "account" && profile?.accountSetupPhase === "failed"
                                ? " portal__stepper-panel--error"
                                : ""
                            }`}
                          >
                            {item.key !== "account" ? (
                              <p className="portal__stepper-hint">{STEP_HINTS[item.key]}</p>
                            ) : null}
                            {renderStepAction(item.key, item.status)}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {isComplete ? (
              <section className="portal__card portal__card--history">
                <div className="portal__history-head">
                  <p className="portal__eyebrow">
                    <span className="portal__eyebrow-tick" />
                    Booked loads
                  </p>
                  <div className="portal__history-filters" role="tablist" aria-label="History period">
                    {(["week", "month", "all"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="tab"
                        aria-selected={historyPeriod === p}
                        className={`portal__history-filter${historyPeriod === p ? " portal__history-filter--active" : ""}`}
                        onClick={() => setHistoryPeriod(p)}
                      >
                        {p === "week" ? "7 days" : p === "month" ? "30 days" : "All"}
                      </button>
                    ))}
                  </div>
                </div>

                {bookingHistory && bookingHistory.totalCount > 0 ? (
                  <>
                    <div className="portal__history-total">
                      <span className="portal__history-total-label">Total booked</span>
                      <span className="portal__history-total-value">
                        {formatMoney(bookingHistory.totalPayout)}
                      </span>
                      <span className="portal__history-total-meta">
                        {bookingHistory.totalCount} load{bookingHistory.totalCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="portal__history-list">
                      {bookingHistory.items.map((item) => (
                        <li key={item.loadId} className="portal__history-item">
                          <div className="portal__history-item-main">
                            <span className="portal__history-route">{item.routeLabel}</span>
                            <span className="portal__history-id">{item.loadId}</span>
                          </div>
                          <div className="portal__history-item-side">
                            <span className="portal__history-payout">{formatMoney(item.payout)}</span>
                            <span className="portal__history-date">{formatDate(item.bookedAt)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="portal__history-empty">No booked loads yet — your first book will show here.</p>
                )}
              </section>
            ) : null}

            {isComplete ? (
              <section className="portal__card">
                <p className="portal__eyebrow">
                  <span className="portal__eyebrow-tick" />
                  Account
                </p>
                <div className="portal__rows">
                  <div className="portal__row">
                    <span className="portal__row-label">Telegram</span>
                    <span
                      className={`portal__status ${
                        telegramConnected ? "portal__status--ok" : "portal__status--pending"
                      }`}
                    >
                      {telegramConnected ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <div className="portal__row">
                    <span className="portal__row-label">Amazon Relay</span>
                    <span
                      className={`portal__status ${
                        relayConnected ? "portal__status--ok" : "portal__status--pending"
                      }`}
                    >
                      {relayConnected ? "Connected" : "Not connected"}
                    </span>
                  </div>

                  <div className="portal__row portal__row--divider">
                    <span className="portal__row-label">Email</span>
                    <span className="portal__row-value">{profile.email}</span>
                  </div>

                  {billing === null ? (
                    billingLoadFailed ? (
                      <div className="portal__row">
                        <span className="portal__row-label">Billing</span>
                        <span className="portal__row-value portal__row-value--muted">Unavailable</span>
                      </div>
                    ) : (
                      <div className="portal__row">
                        <span className="portal__row-label">Billing</span>
                        <span className="portal__row-value portal__row-value--muted">Loading…</span>
                      </div>
                    )
                  ) : billing.status === "none" ? (
                    <div className="portal__row">
                      <span className="portal__row-label">Plan</span>
                      <span className="portal__row-value portal__row-value--muted">No subscription</span>
                    </div>
                  ) : (
                    <>
                      <div className="portal__row">
                        <span className="portal__row-label">Plan</span>
                        <span className="portal__row-value">{billing.plan.toUpperCase()}</span>
                      </div>
                      <div className="portal__row">
                        <span className="portal__row-label">Status</span>
                        <span
                          className={`portal__badge portal__badge--${
                            billing.status === "active"
                              ? "ok"
                              : billing.status === "past_due"
                                ? "warn"
                                : "muted"
                          }`}
                        >
                          {billing.status === "active"
                            ? "Active"
                            : billing.status === "past_due"
                              ? "Past due"
                              : "Canceled"}
                        </span>
                      </div>
                      {billing.currentPeriodEnd ? (
                        <div className="portal__row">
                          <span className="portal__row-label">
                            {billing.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
                          </span>
                          <span className="portal__row-value">
                            {formatDate(billing.currentPeriodEnd)}
                          </span>
                        </div>
                      ) : null}
                    </>
                  )}

                  <div className="portal__actions portal__row--divider">
                    {billing?.status === "none" ? (
                      <a className="portal__text-action" href="/#pricing">
                        <span>Subscribe</span>
                        <span aria-hidden="true">→</span>
                      </a>
                    ) : billing ? (
                      <button
                        type="button"
                        className="portal__text-action"
                        disabled={billingLoading}
                        onClick={openBillingPortal}
                      >
                        <span>{billingLoading ? "Opening…" : "Manage billing"}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="portal__text-action portal__text-action--muted"
                      onClick={signOut}
                    >
                      Sign out
                    </button>
                    {billingError ? <p className="portal__billing-error">{billingError}</p> : null}
                    <p className="portal__support">
                      Need help? Email{" "}
                      <a href="mailto:support@haulbot.online">support@haulbot.online</a>
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </SiteLayout>
  );
}
