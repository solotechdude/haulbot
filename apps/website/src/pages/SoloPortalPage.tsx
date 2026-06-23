import { useEffect, useState } from "react";
import type { DriverProfile } from "@relaybooking/shared";
import { SiteLayout } from "../components/SiteLayout";
import { Card } from "../components/ui/Card";
import "./SoloPortalPage.css";

const DEV_USER_ID = "dev-user-1";

export function SoloPortalPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dispatcher/profile", {
      headers: { "x-user-id": DEV_USER_ID },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "No account yet" : "Failed to load profile");
        return res.json() as Promise<DriverProfile>;
      })
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <SiteLayout>
      <Card title="Subscriber portal">
        {error ? (
          <p>{error}. Seed a dev user in MongoDB or complete onboarding (Track 1).</p>
        ) : profile ? (
          <dl className="solo-status">
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            <dt>Onboarding</dt>
            <dd>{profile.onboardingStep}</dd>
            <dt>Telegram</dt>
            <dd>{profile.telegramLinked ? "Connected" : "Not connected"}</dd>
          </dl>
        ) : (
          <p>Loading…</p>
        )}
      </Card>
    </SiteLayout>
  );
}
