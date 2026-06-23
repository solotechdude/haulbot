import { SiteLayout } from "../components/SiteLayout";
import { Button } from "../components/ui/Button";
import "../components/ui/Button.css";
import "./MarketingPage.css";

export function MarketingPage() {
  return (
    <SiteLayout>
      <div className="hero">
        <p className="hero__eyebrow">AI dispatch for solo Relay drivers</p>
        <h1 className="hero__title">Book loads while you drive.</h1>
        <p className="hero__lead">
          Set goals or campaigns in Telegram. A dedicated remote agent searches, books, and assigns
          loads on Amazon Relay.
        </p>
        <div className="hero__actions">
          <Button variant="primary">Subscribe — coming soon</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/solo")}>
            Subscriber portal
          </Button>
        </div>
      </div>
    </SiteLayout>
  );
}
