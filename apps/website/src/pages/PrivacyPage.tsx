import { LEGAL_ENTITY, formatLegalAddress } from "@haulbot/shared";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/SiteLayout";
import "./LegalPage.css";

export function PrivacyPage() {
  const { name, supportEmail } = LEGAL_ENTITY;
  const address = formatLegalAddress();

  return (
    <SiteLayout>
      <article className="legal">
        <h1 className="legal__title">Privacy Policy</h1>
        <p className="legal__meta">Effective July 5, 2026 · {name}</p>

        <section className="legal__section">
          <h2>1. Overview</h2>
          <p>
            {name} (&ldquo;Haulbot,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) respects your
            privacy. This Privacy Policy explains what information we collect, how we use it, and
            your choices. It applies to our website, subscriber portal, and dispatch automation
            service.
          </p>
        </section>

        <section className="legal__section">
          <h2>2. Information We Collect</h2>
          <ul>
            <li>
              <strong>Account information:</strong> email address and identifiers needed to create
              and manage your account.
            </li>
            <li>
              <strong>Telegram linkage:</strong> Telegram user ID and chat identifiers when you
              connect the Haulbot bot.
            </li>
            <li>
              <strong>Dispatch configuration:</strong> campaign settings, goals, rules, and
              operational preferences you provide through Telegram or the portal.
            </li>
            <li>
              <strong>Service telemetry:</strong> load-board scan summaries, booking outcomes, agent
              status, and related operational logs needed to run and improve the Service.
            </li>
            <li>
              <strong>Payment information:</strong> billing is processed by Stripe. We receive
              subscription status and customer identifiers from Stripe; we do not store full payment
              card numbers on our servers.
            </li>
            <li>
              <strong>Technical data:</strong> IP address, browser type, and similar logs for
              security, fraud prevention, and consent records (such as Terms acceptance timestamps).
            </li>
          </ul>
        </section>

        <section className="legal__section">
          <h2>3. How We Use Information</h2>
          <p>We use collected information to:</p>
          <ul>
            <li>Provide, operate, and maintain the Service;</li>
            <li>Process subscriptions and communicate about billing;</li>
            <li>Connect your Telegram account and execute dispatch on your behalf;</li>
            <li>Monitor service health, prevent abuse, and respond to support requests;</li>
            <li>Comply with legal obligations and enforce our <Link to="/terms">Terms of Service</Link>.</li>
          </ul>
        </section>

        <section className="legal__section">
          <h2>4. Service Providers</h2>
          <p>
            We use trusted third parties that process data on our behalf, including Stripe
            (payments), cloud infrastructure providers (hosting and dedicated environments), and
            Telegram (messaging interface). These providers are authorized to use your information
            only as needed to perform services for us and subject to their own privacy policies.
          </p>
        </section>

        <section className="legal__section">
          <h2>5. Data Retention</h2>
          <p>
            We retain information for as long as your account is active and as needed to provide the
            Service, resolve disputes, enforce agreements, and meet legal requirements. Operational
            telemetry may be retained for shorter periods with automatic deletion where configured.
          </p>
        </section>

        <section className="legal__section">
          <h2>6. Security</h2>
          <p>
            We use administrative, technical, and organizational measures designed to protect your
            information. No method of transmission or storage is completely secure; we cannot
            guarantee absolute security.
          </p>
        </section>

        <section className="legal__section">
          <h2>7. Your Choices</h2>
          <p>
            You may cancel your subscription through the billing portal. You may contact us to
            request access, correction, or deletion of personal information where applicable law
            provides those rights. Some data must be retained for billing, security, or legal
            compliance.
          </p>
        </section>

        <section className="legal__section">
          <h2>8. Children</h2>
          <p>
            The Service is not directed to individuals under 18. We do not knowingly collect
            personal information from children.
          </p>
        </section>

        <section className="legal__section">
          <h2>9. Changes</h2>
          <p>
            We may update this Privacy Policy from time to time. The effective date at the top will
            change when we do. Material changes will be posted on our website.
          </p>
        </section>

        <section className="legal__section">
          <h2>10. Contact</h2>
          <p>
            Questions about this Privacy Policy:
            <br />
            {name}
            <br />
            {address}
            <br />
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
        </section>
      </article>
    </SiteLayout>
  );
}
