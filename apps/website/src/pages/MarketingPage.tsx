import { useState } from "react";
import { SiteLayout } from "../components/SiteLayout";
import { Button } from "../components/ui/Button";
import "../components/ui/Button.css";
import "./MarketingPage.css";

async function startCheckout(email: string): Promise<string> {
  const res = await fetch("/api/billing/checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Checkout failed");
  }
  return data.url;
}

export function MarketingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const canceled = params.get("checkout") === "canceled";

  async function handleSubscribe() {
    setError(null);
    setLoading(true);
    try {
      const url = await startCheckout(email);
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <SiteLayout>
      <div className="hero">
        <p className="hero__eyebrow">AI dispatch for solo Relay drivers</p>
        <h1 className="hero__title">Book loads while you drive.</h1>
        <p className="hero__lead">
          Set goals or campaigns in Telegram. A dedicated remote agent searches, books, and assigns
          loads on Amazon Relay.
        </p>

        {canceled ? <p className="hero__notice">Checkout canceled. Try again when ready.</p> : null}

        <div className="hero__subscribe">
          <label className="hero__label" htmlFor="subscribe-email">
            Email for your account
          </label>
          <input
            id="subscribe-email"
            className="hero__input"
            type="email"
            placeholder="you@carrier.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          {error ? <p className="hero__error">{error}</p> : null}
        </div>

        <div className="hero__actions">
          <Button variant="primary" disabled={loading || !email.includes("@")} onClick={handleSubscribe}>
            {loading ? "Redirecting…" : "Subscribe — $199/mo"}
          </Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/solo")}>
            Subscriber portal
          </Button>
        </div>
      </div>
    </SiteLayout>
  );
}
