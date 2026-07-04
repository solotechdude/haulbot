import { useCallback, useEffect, useState } from "react";
import type { DriverProfile, OnboardingStep } from "@haulbot/shared";
import { SiteLayout } from "../components/SiteLayout";
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

type StepStatus = "done" | "current" | "upcoming";

interface AgentTrip {
  origin: string;
  destination: string;
  status: string;
  deliveryEta: string | null;
}

interface AgentScan {
  scanned: number;
  booked: boolean;
  at: string;
}

interface AgentStatus {
  running: boolean;
  paused: boolean;
  trip: AgentTrip | null;
  lastScan: AgentScan | null;
  alert: "reconnect_relay" | "agent_offline" | null;
  heartbeatAt: string | null;
  updatedAt: string | null;
}

type BillingSummary =
  | { status: "none" }
  | {
      plan: string;
      status: "active" | "past_due" | "canceled";
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    };

const TELEGRAM_BOT_URL = `https://t.me/${
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "SwiftRelaySoloBot"
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

function formatEta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
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

export function SoloPortalPage() {
  const [userId, setUserId] = useState<string | null>(resolveInitialUserId);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoadFailed, setBillingLoadFailed] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const checkoutSuccess = params.get("checkout") === "success";

  const loadProfile = useCallback(async (id: string) => {
    const res = await fetch("/api/onboarding/status", {
      headers: authHeaders(id),
    });
    if (!res.ok) throw new Error(res.status === 404 ? "No account yet" : "Failed to load profile");
    return res.json() as Promise<DriverProfile>;
  }, []);

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;

    verifyToken(token)
      .then((id) => {
        localStorage.setItem(SESSION_KEY, id);
        setUserId(id);
        window.history.replaceState({}, "", "/solo");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    const poll = () => {
      loadProfile(userId)
        .then((p) => {
          if (!active) return;
          setProfile(p);
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
    const needsTelegramLink =
      profile?.onboardingStep === "environment_ready" || profile?.telegramDevStub;
    if (!userId || !needsTelegramLink) return;

    fetch("/api/onboarding/telegram-deeplink", { headers: authHeaders(userId) })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to get Telegram link");
        const data = (await res.json()) as { url: string };
        setTelegramUrl(data.url);
      })
      .catch(() => setTelegramUrl(null));
  }, [userId, profile?.onboardingStep, profile?.telegramDevStub]);

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

  async function connectTelegramDevStub() {
    if (!userId) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/telegram-link", {
        method: "POST",
        headers: authHeaders(userId),
      });
      if (!res.ok) throw new Error("Failed to connect Telegram");
      setProfile(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLinking(false);
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

  let agentPillLabel = "Idle";
  let agentPillMod = "idle";
  if (agentStatus?.running) {
    agentPillLabel = "Running";
    agentPillMod = "running";
  } else if (agentStatus?.paused) {
    agentPillLabel = "Paused";
    agentPillMod = "paused";
  }

  const agentAlertMessage =
    agentStatus?.alert === "reconnect_relay"
      ? "Reconnect Amazon Relay in Telegram"
      : agentStatus?.alert === "agent_offline"
        ? "Your agent looks offline — open Telegram to check."
        : null;

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

  function renderStepAction(key: string, status: StepStatus) {
    if (status !== "current") return null;

    if (key === "telegram") {
      return (
        <div className="portal__step-action">
          {telegramUrl ? (
            <Button variant="primary" onClick={() => window.open(telegramUrl, "_blank", "noopener")}>
              Connect Telegram
            </Button>
          ) : (
            <p className="portal__hint">Loading Telegram link…</p>
          )}
          {import.meta.env.DEV ? (
            <Button variant="secondary" disabled={linking} onClick={connectTelegramDevStub}>
              {linking ? "Connecting…" : "Dev stub (skip Telegram)"}
            </Button>
          ) : null}
        </div>
      );
    }

    if (key === "relay") {
      return (
        <div className="portal__step-action">
          <p className="portal__hint">
            In Telegram, send{" "}
            <code className="portal__code">
              {step === "relay_2fa_required" ? "/2fa YOUR_CODE" : "/connect_relay"}
            </code>
          </p>
        </div>
      );
    }

    return null;
  }

  return (
    <SiteLayout>
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
              <section className="portal__card">
                <p className="portal__eyebrow">
                  <span className="portal__eyebrow-tick" />
                  Agent status
                </p>
                <div className="portal__glance-head">
                  <span className={`portal__pill portal__pill--${agentPillMod}`}>
                    {agentPillLabel}
                  </span>
                  <Button
                    variant="primary"
                    onClick={() => window.open(TELEGRAM_BOT_URL, "_blank", "noopener")}
                  >
                    Open in Telegram
                  </Button>
                </div>

                {agentAlertMessage ? (
                  <div className="portal__alert" role="status">
                    {agentAlertMessage}
                  </div>
                ) : null}

                <div className="portal__glance-item">
                  <span className="portal__glance-label">Active trip</span>
                  {agentStatus?.trip ? (
                    <span className="portal__glance-value">
                      {agentStatus.trip.origin} → {agentStatus.trip.destination}
                      <span className="portal__glance-meta">
                        {agentStatus.trip.status}
                        {agentStatus.trip.deliveryEta
                          ? ` · ETA ${formatEta(agentStatus.trip.deliveryEta)}`
                          : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="portal__glance-value portal__glance-value--muted">
                      No active trip.
                    </span>
                  )}
                </div>

                <div className="portal__glance-item">
                  <span className="portal__glance-label">Last activity</span>
                  {agentStatus?.lastScan ? (
                    <span className="portal__glance-value">
                      Last scan {formatTime(agentStatus.lastScan.at)}: {agentStatus.lastScan.scanned}{" "}
                      loads — {agentStatus.lastScan.booked ? "booked" : "no match"}
                    </span>
                  ) : (
                    <span className="portal__glance-value portal__glance-value--muted">
                      No recent scans.
                    </span>
                  )}
                </div>
              </section>
            ) : null}

            {isComplete ? (
              <div className="portal__card portal__done">
                <span className="portal__marker portal__marker--done">
                  <CheckIcon />
                </span>
                <div>
                  <p className="portal__done-title">Setup complete</p>
                  <p className="portal__hint">
                    You&apos;re all set — open Telegram to set goals and campaigns.
                  </p>
                </div>
              </div>
            ) : (
              <div className="portal__card portal__card--feature">
                <p className="portal__eyebrow">
                  <span className="portal__eyebrow-tick" />
                  Get started
                </p>
                <h2 className="portal__title">Finish setting up</h2>
                <ol className="portal__checklist">
                  {checklist.map((item) => (
                    <li
                      key={item.key}
                      className={`portal__step portal__step--${item.status}`}
                      aria-current={item.status === "current" ? "step" : undefined}
                    >
                      <span className={`portal__marker portal__marker--${item.status}`}>
                        {item.status === "done" ? <CheckIcon /> : null}
                      </span>
                      <div className="portal__step-body">
                        <p className="portal__step-title">{item.title}</p>
                        {renderStepAction(item.key, item.status)}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="portal__card">
              <p className="portal__eyebrow">
                <span className="portal__eyebrow-tick" />
                Connections
              </p>
              <div className="portal__row">
                <span className="portal__row-label">Telegram</span>
                <span
                  className={`portal__status ${
                    telegramConnected ? "portal__status--ok" : "portal__status--pending"
                  }`}
                >
                  {profile.telegramDevStub
                    ? "Connected (dev stub)"
                    : telegramConnected
                      ? "Connected"
                      : "Not connected"}
                </span>
              </div>
              <div className="portal__row">
                <span className="portal__row-label">Amazon Relay</span>
                <span
                  className={`portal__status ${
                    relayConnected ? "portal__status--ok" : "portal__status--pending"
                  }`}
                >
                  {relayConnected ? "Connected" : "Action needed — link it from the checklist above"}
                </span>
              </div>
            </div>

            <div className="portal__card">
              <p className="portal__eyebrow">
                <span className="portal__eyebrow-tick" />
                Account
              </p>
              <div className="portal__row">
                <span className="portal__row-label">Email</span>
                <span className="portal__row-value">{profile.email}</span>
              </div>
              <div className="portal__account-actions">
                <Button variant="secondary" onClick={signOut}>
                  Sign out
                </Button>
              </div>
              <p className="portal__support">
                Need help? Email{" "}
                <a href="mailto:support@haulbot.online">support@haulbot.online</a>
              </p>
            </div>

            <section className="portal__card">
              <p className="portal__eyebrow">
                <span className="portal__eyebrow-tick" />
                Billing
              </p>
              {billing === null ? (
                billingLoadFailed ? (
                  <p className="portal__hint">Billing details are unavailable right now.</p>
                ) : (
                  <p className="portal__hint">Loading…</p>
                )
              ) : billing.status === "none" ? (
                <>
                  <p className="portal__message">No active subscription.</p>
                  <div className="portal__account-actions">
                    <Button
                      variant="primary"
                      onClick={() => {
                        window.location.href = "/#pricing";
                      }}
                    >
                      Subscribe
                    </Button>
                  </div>
                </>
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
                  <div className="portal__account-actions">
                    <Button variant="primary" disabled={billingLoading} onClick={openBillingPortal}>
                      {billingLoading ? "Opening…" : "Manage billing"}
                    </Button>
                  </div>
                  {billingError ? <p className="portal__billing-error">{billingError}</p> : null}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
