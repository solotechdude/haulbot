import { useCallback, useEffect, useState } from "react";
import type { DriverProfile, OnboardingStep } from "@relaybooking/shared";
import { SiteLayout } from "../components/SiteLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import "../components/ui/Button.css";
import "./SoloPortalPage.css";

const DEV_USER_ID = "dev-user-1";
const SESSION_KEY = "relaybooking_user_id";

const STEP_LABELS: Record<OnboardingStep, string> = {
  subscribed: "Provisioning your dedicated environment",
  environment_ready: "Connect Telegram",
  telegram_linked: "Connect Amazon Relay in Telegram",
  relay_login_pending: "Complete Relay login in Telegram",
  relay_2fa_required: "Enter 2FA in Telegram",
  relay_ready: "Waiting for agent heartbeat",
  active: "Ready to dispatch",
};

function resolveInitialUserId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) return null;
  return sessionStorage.getItem(SESSION_KEY) ?? (import.meta.env.DEV ? DEV_USER_ID : null);
}

async function verifyToken(token: string): Promise<string> {
  const res = await fetch(`/api/auth/magic-link?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error("Invalid or expired link");
  const data = (await res.json()) as { userId: string };
  return data.userId;
}

export function SoloPortalPage() {
  const [userId, setUserId] = useState<string | null>(resolveInitialUserId);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const checkoutSuccess = params.get("checkout") === "success";

  const loadProfile = useCallback(async (id: string) => {
    const res = await fetch("/api/onboarding/status", {
      headers: { "x-user-id": id },
    });
    if (!res.ok) throw new Error(res.status === 404 ? "No account yet" : "Failed to load profile");
    return res.json() as Promise<DriverProfile>;
  }, []);

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;

    verifyToken(token)
      .then((id) => {
        sessionStorage.setItem(SESSION_KEY, id);
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
          if (active) setProfile(p);
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

    fetch("/api/onboarding/telegram-deeplink", { headers: { "x-user-id": userId } })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to get Telegram link");
        const data = (await res.json()) as { url: string };
        setTelegramUrl(data.url);
      })
      .catch(() => setTelegramUrl(null));
  }, [userId, profile?.onboardingStep, profile?.telegramDevStub]);

  async function connectTelegramDevStub() {
    if (!userId) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/telegram-link", {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      if (!res.ok) throw new Error("Failed to connect Telegram");
      setProfile(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLinking(false);
    }
  }

  const step = profile?.onboardingStep;
  const showTelegramStep = step === "environment_ready" || profile?.telegramDevStub;
  const showRelayStep =
    (step === "telegram_linked" || step === "relay_2fa_required") &&
    profile?.telegramLinked &&
    !profile?.telegramDevStub;
  const isComplete = step === "active";

  return (
    <SiteLayout>
      <Card title="Subscriber portal">
        {checkoutSuccess && !error ? (
          <p className="solo-banner">Payment received. Complete onboarding below.</p>
        ) : null}

        {error ? (
          <p>{error}. Use the link from your checkout email or contact support.</p>
        ) : !userId ? (
          <p>Verifying your secure link…</p>
        ) : !profile ? (
          <p>Loading…</p>
        ) : (
          <>
            <dl className="solo-status">
              <dt>Email</dt>
              <dd>{profile.email}</dd>
              <dt>Onboarding</dt>
              <dd>{step ? STEP_LABELS[step] : "—"}</dd>
              <dt>Telegram</dt>
              <dd>
                {profile.telegramDevStub
                  ? "Dev stub only — link real Telegram below"
                  : profile.telegramLinked
                    ? "Connected"
                    : "Not connected"}
              </dd>
            </dl>

            {showTelegramStep ? (
              <div className="solo-step">
                <p>
                  {profile.telegramDevStub
                    ? "The dev stub skips real Telegram. Open Telegram and tap Start to link this chat."
                    : "Open Telegram and tap Start to link this account."}
                </p>
                {telegramUrl ? (
                  <Button variant="primary" onClick={() => window.open(telegramUrl, "_blank")}>
                    Connect Telegram
                  </Button>
                ) : (
                  <p>Loading Telegram link…</p>
                )}
                {import.meta.env.DEV ? (
                  <Button variant="secondary" disabled={linking} onClick={connectTelegramDevStub}>
                    {linking ? "Connecting…" : "Dev stub (skip Telegram)"}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {showRelayStep ? (
              <div className="solo-step">
                <p>
                  In Telegram, send{" "}
                  <code>{step === "relay_2fa_required" ? "/2fa YOUR_CODE" : "/connect_relay"}</code> to
                  link Amazon Relay.
                </p>
              </div>
            ) : null}

            {isComplete ? (
              <p className="solo-complete">You&apos;re set. Open Telegram to set goals and campaigns.</p>
            ) : null}
          </>
        )}
      </Card>
    </SiteLayout>
  );
}
