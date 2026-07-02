import { useCallback, useEffect, useState } from "react";
import { SiteLayout } from "../components/SiteLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import "../components/ui/Button.css";
import "./AdminPage.css";

const ADMIN_TOKEN_KEY = "relaybooking_admin_token";
const HEARTBEAT_FRESH_MS = 2 * 60 * 1000;

interface CustomerRow {
  userId: string;
  email: string;
  subscriptionStatus: string;
  onboardingStep: string;
  provisionState: string;
  paused: boolean;
  heartbeatAt: string | null;
  activeLeg: { mode: string; origin: string | null; destination: string | null } | null;
  commitmentLoadId: string | null;
}

interface TimelineEvent {
  type?: string;
  message?: string;
  createdAt?: string;
}

interface CustomerDetail {
  profile: { email: string; onboardingStep: string; paused: boolean } | null;
  subscription: { status?: string; plan?: string } | null;
  environment: {
    provisionState?: string;
    provider?: string;
    portalEndpoint?: string | null;
    lastError?: string | null;
  } | null;
  dispatchState: {
    paused?: boolean;
    heartbeatAt?: string;
    activeLeg?: { mode?: string; searchCriteria?: { origin?: string; destination?: string } } | null;
    commitment?: { loadId?: string; status?: string } | null;
    agentStatus?: { relayWorkState?: string } | null;
  } | null;
  events: TimelineEvent[];
  alerts: { type?: string; loadId?: string; createdAt?: string }[];
  bookings: { loadId?: string; origin?: string; destination?: string; payout?: number; createdAt?: string }[];
  telemetryCount: number;
}

function agentHealth(heartbeatAt: string | null | undefined, paused: boolean): string {
  if (paused) return "paused";
  if (!heartbeatAt) return "offline";
  return Date.now() - new Date(heartbeatAt).getTime() < HEARTBEAT_FRESH_MS ? "online" : "stale";
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function adminFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { ...init?.headers, "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function AdminPage() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadCustomers = useCallback(async (adminToken: string) => {
    try {
      const data = await adminFetch<{ customers: CustomerRow[] }>(adminToken, "/customers");
      setCustomers(data.customers);
      setError(null);
    } catch (err) {
      if ((err as Error).message === "UNAUTHORIZED") {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken("");
        setError("Invalid admin token.");
      } else {
        setError("Could not load customers.");
      }
    }
  }, []);

  const loadDetail = useCallback(
    async (userId: string) => {
      if (!token) return;
      try {
        setDetail(await adminFetch<CustomerDetail>(token, `/customers/${userId}`));
      } catch {
        setDetail(null);
        setError("Could not load customer detail.");
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    void loadCustomers(token);
    const interval = setInterval(() => void loadCustomers(token), 15_000);
    return () => clearInterval(interval);
  }, [token, loadCustomers]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  async function runAction(path: string, body?: unknown) {
    if (!token || !selected) return;
    setActionBusy(true);
    try {
      await adminFetch(token, `/customers/${selected}${path}`, {
        method: "POST",
        body: body != null ? JSON.stringify(body) : undefined,
      });
      await Promise.all([loadDetail(selected), loadCustomers(token)]);
    } catch {
      setError("Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  if (!token) {
    return (
      <SiteLayout>
        <Card title="Admin dashboard">
          <p>Enter the Product Admin token.</p>
          <div className="admin-login">
            <input
              className="admin-login__input"
              type="password"
              placeholder="Admin token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={!tokenInput}
              onClick={() => {
                sessionStorage.setItem(ADMIN_TOKEN_KEY, tokenInput);
                setToken(tokenInput);
                setTokenInput("");
              }}
            >
              Sign in
            </Button>
          </div>
          {error ? <p className="admin-error">{error}</p> : null}
        </Card>
      </SiteLayout>
    );
  }

  const state = detail?.dispatchState;

  return (
    <SiteLayout>
      <Card title="Customers">
        {error ? <p className="admin-error">{error}</p> : null}
        {!customers ? (
          <p>Loading…</p>
        ) : customers.length === 0 ? (
          <p>No customers yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Subscription</th>
                <th>Onboarding</th>
                <th>Environment</th>
                <th>Agent</th>
                <th>Leg</th>
                <th>Trip</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((row) => (
                <tr
                  key={row.userId}
                  className={row.userId === selected ? "admin-table__row--active" : undefined}
                  onClick={() => setSelected(row.userId === selected ? null : row.userId)}
                >
                  <td>{row.email || row.userId}</td>
                  <td>{row.subscriptionStatus}</td>
                  <td>{row.onboardingStep}</td>
                  <td>{row.provisionState}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${agentHealth(row.heartbeatAt, row.paused)}`}>
                      {agentHealth(row.heartbeatAt, row.paused)}
                    </span>
                  </td>
                  <td>
                    {row.activeLeg
                      ? `${row.activeLeg.mode}: ${row.activeLeg.origin ?? "?"} → ${row.activeLeg.destination ?? "?"}`
                      : "—"}
                  </td>
                  <td>{row.commitmentLoadId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected && detail ? (
        <Card title={detail.profile?.email ?? selected}>
          <div className="admin-detail">
            <dl className="admin-detail__facts">
              <dt>Onboarding</dt>
              <dd>{detail.profile?.onboardingStep ?? "—"}</dd>
              <dt>Environment</dt>
              <dd>
                {detail.environment
                  ? `${detail.environment.provisionState}${detail.environment.provider ? ` (${detail.environment.provider})` : ""}`
                  : "—"}
                {detail.environment?.lastError ? ` — ${detail.environment.lastError}` : ""}
              </dd>
              <dt>Heartbeat</dt>
              <dd>{formatWhen(state?.heartbeatAt)}</dd>
              <dt>Work state</dt>
              <dd>{state?.agentStatus?.relayWorkState ?? "—"}</dd>
              <dt>Active leg</dt>
              <dd>
                {state?.activeLeg
                  ? `${state.activeLeg.mode}: ${state.activeLeg.searchCriteria?.origin ?? "?"} → ${state.activeLeg.searchCriteria?.destination ?? "?"}`
                  : "—"}
              </dd>
              <dt>Commitment</dt>
              <dd>
                {state?.commitment?.loadId
                  ? `${state.commitment.loadId} (${state.commitment.status ?? "booked"})`
                  : "—"}
              </dd>
              <dt>Telemetry (30d)</dt>
              <dd>{detail.telemetryCount} events</dd>
            </dl>

            <div className="admin-detail__actions">
              <Button
                variant="secondary"
                disabled={actionBusy}
                onClick={() => void runAction("/paused", { paused: !state?.paused })}
              >
                {state?.paused ? "Resume agent" : "Pause agent"}
              </Button>
              <Button
                variant="secondary"
                disabled={actionBusy || !state?.commitment}
                onClick={() => void runAction("/clear-commitment")}
              >
                Clear commitment
              </Button>
            </div>
          </div>

          <h3 className="admin-section">Recent bookings</h3>
          {detail.bookings.length === 0 ? (
            <p className="admin-empty">None yet.</p>
          ) : (
            <ul className="admin-list">
              {detail.bookings.map((b, i) => (
                <li key={i}>
                  {formatWhen(b.createdAt)} — {b.loadId} {b.origin ?? "?"} → {b.destination ?? "?"}
                  {b.payout != null ? ` ($${b.payout})` : ""}
                </li>
              ))}
            </ul>
          )}

          <h3 className="admin-section">Relay alerts</h3>
          {detail.alerts.length === 0 ? (
            <p className="admin-empty">None.</p>
          ) : (
            <ul className="admin-list">
              {detail.alerts.map((a, i) => (
                <li key={i}>
                  {formatWhen(a.createdAt)} — {a.type} {a.loadId ?? ""}
                </li>
              ))}
            </ul>
          )}

          <h3 className="admin-section">Environment timeline</h3>
          {detail.events.length === 0 ? (
            <p className="admin-empty">No events.</p>
          ) : (
            <ul className="admin-list">
              {detail.events.map((e, i) => (
                <li key={i}>
                  {formatWhen(e.createdAt)} — {e.type}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </SiteLayout>
  );
}
