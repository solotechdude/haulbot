import { LEGAL_ENTITY, SUBSCRIPTION_PRICE_USD, TERMS_VERSION, formatLegalAddress } from "@haulbot/shared";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/SiteLayout";
import "./LegalPage.css";

export function TermsPage() {
  const { name, governingLawState, supportEmail } = LEGAL_ENTITY;
  const address = formatLegalAddress();

  return (
    <SiteLayout>
      <article className="legal">
        <h1 className="legal__title">Terms of Service</h1>
        <p className="legal__meta">
          Version {TERMS_VERSION} · Effective July 5, 2026 · {name}
        </p>

        <section className="legal__section">
          <h2>1. Agreement</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you and{" "}
            {name} (&ldquo;Haulbot,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
            By creating an account, subscribing, or using our service, you agree to these Terms and
            our <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the
            service.
          </p>
        </section>

        <section className="legal__section">
          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old and able to form a binding contract. The service is
            intended for solo owner-operators and small carriers who use Amazon Relay and dispatch
            through our automation tools. You represent that information you provide is accurate and
            that you have authority to bind any business entity on whose behalf you subscribe.
          </p>
        </section>

        <section className="legal__section">
          <h2>3. The Service</h2>
          <p>
            Haulbot provides subscription access to software that automates load-board search and
            booking workflows on Amazon Relay through a dedicated environment and Telegram-based
            interface (the &ldquo;Service&rdquo;). We grant you a limited, non-exclusive,
            non-transferable, revocable license to use the Service for your internal dispatch
            operations during an active paid subscription.
          </p>
          <p>
            The Service is a tool. You remain solely responsible for your Amazon Relay account, your
            equipment, your drivers, compliance with Amazon&apos;s terms and policies, and all
            booking and operational decisions.
          </p>
        </section>

        <section className="legal__section">
          <h2>4. Subscription and Billing</h2>
          <p>
            The SOLO plan is billed at ${SUBSCRIPTION_PRICE_USD} USD per month. Subscriptions renew
            automatically each billing period until canceled. By subscribing, you authorize us and
            our payment processor (Stripe) to charge your payment method on a recurring basis.
          </p>
          <p>
            Prices may change with notice; changes apply to subsequent billing periods. Taxes may
            apply where required by law.
          </p>
        </section>

        <section className="legal__section">
          <h2>5. All Sales Final — No Refunds</h2>
          <p>
            <strong>All sales are final.</strong> Except where required by applicable law, we do not
            offer refunds, credits, or returns for any reason, including partial billing periods,
            unused time, lack of usage, dissatisfaction with results, load availability, booking
            outcomes, or account termination. Fees are earned upon payment and provision of digital
            access to the Service.
          </p>
        </section>

        <section className="legal__section">
          <h2>6. Cancellation</h2>
          <p>
            You may cancel your subscription at any time through the Stripe customer billing portal
            linked from your account. Cancellation stops future charges. Unless required by law,
            cancellation takes effect at the <strong>end of your current paid billing period</strong>
            ; you retain access through that period and will not receive a refund for time remaining
            in the period. We may suspend or terminate access immediately for breach of these Terms.
          </p>
        </section>

        <section className="legal__section">
          <h2>7. No Guarantees</h2>
          <p>We do not guarantee that the Service will:</p>
          <ul>
            <li>Find, book, or secure any particular load, lane, rate, or revenue;</li>
            <li>Operate without interruption or error;</li>
            <li>Meet your business goals or expectations; or</li>
            <li>Remain compatible with Amazon Relay at all times.</li>
          </ul>
          <p>
            Results depend on market conditions, your Relay account standing, configuration, and
            factors outside our control.
          </p>
        </section>

        <section className="legal__section">
          <h2>8. Amazon Relay Disclaimer</h2>
          <p>
            Haulbot is <strong>not affiliated with, endorsed by, or sponsored by</strong> Amazon.com,
            Inc., Amazon Relay, or any of their affiliates. Amazon Relay is a third-party platform
            subject to its own terms. You are responsible for compliance with Amazon&apos;s policies
            and for any actions taken through your Relay account.
          </p>
        </section>

        <section className="legal__section">
          <h2>9. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service unlawfully or to violate third-party terms (including Amazon&apos;s);</li>
            <li>Share credentials, resell access, or allow unauthorized use of your account;</li>
            <li>Reverse engineer, scrape, or interfere with the Service or our systems;</li>
            <li>Submit false information or impersonate another person or entity.</li>
          </ul>
        </section>

        <section className="legal__section">
          <h2>10. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
            WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </section>

        <section className="legal__section">
          <h2>11. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, HAULBOT AND ITS OFFICERS, MEMBERS, EMPLOYEES,
            AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM YOUR
            USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE OR THESE
            TERMS WILL NOT EXCEED THE AMOUNT YOU PAID TO HAULBOT IN THE TWELVE (12) MONTHS BEFORE
            THE EVENT GIVING RISE TO THE CLAIM.
          </p>
        </section>

        <section className="legal__section">
          <h2>12. Indemnification</h2>
          <p>
            You will defend, indemnify, and hold harmless Haulbot from claims, damages, and expenses
            (including reasonable attorneys&apos; fees) arising from your use of the Service, your
            Relay account, your violation of these Terms, or your violation of any third-party rights
            or policies.
          </p>
        </section>

        <section className="legal__section">
          <h2>13. Dispute Resolution</h2>
          <p>
            Before initiating a chargeback, payment dispute, or formal legal action, you agree to
            contact us at{" "}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a> and allow at least fifteen (15)
            business days for us to investigate and respond in good faith. Nothing in this section
            limits your rights under applicable payment-network or consumer-protection rules where
            those rights cannot be waived.
          </p>
          <p>
            Except for qualifying small-claims matters or requests for injunctive relief, any dispute
            arising out of or relating to these Terms or the Service will be resolved by{" "}
            <strong>binding individual arbitration</strong> administered by the American Arbitration
            Association (AAA) under its Consumer Arbitration Rules, and not in court.{" "}
            <strong>You and Haulbot waive any right to participate in a class action</strong> or
            class-wide arbitration.
          </p>
          <p>
            The arbitrator may award the same damages a court could award on an individual basis.
            Judgment on the award may be entered in any court with jurisdiction.
          </p>
        </section>

        <section className="legal__section">
          <h2>14. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of {governingLawState}, without regard
            to conflict-of-law principles, except where preempted by applicable federal law.
          </p>
        </section>

        <section className="legal__section">
          <h2>15. Changes</h2>
          <p>
            We may update these Terms from time to time. The version and effective date at the top
            of this page will change when we do. Material changes will be posted on our website.
            Continued use after changes become effective constitutes acceptance of the updated Terms.
            New subscribers must accept the current version at checkout.
          </p>
        </section>

        <section className="legal__section">
          <h2>16. Contact</h2>
          <p>
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
