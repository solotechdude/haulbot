import { useState } from "react";
import { heroChat, type MarketingChatMessage } from "@haulbot/shared";
import { SiteLayout } from "../components/SiteLayout";
import { HeroDemoVideo } from "../components/HeroDemoVideo";
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

type ChatMessage = MarketingChatMessage;

function DoubleCheck() {
  return (
    <svg className="chat__ticks" viewBox="0 0 18 11" width="16" height="10" aria-hidden="true">
      <path
        d="M1 5.9 4.3 9.2 9.8 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.6 9.2 13.1 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg className="hero__trust-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.1" />
      <path
        d="m4.8 8.2 2.1 2.1 4.3-4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatMock({ title, messages }: { title?: string; messages: ChatMessage[] }) {
  return (
    <div className="chat" role="img" aria-label={title ?? "Example conversation with the Haulbot bot"}>
      <div className="chat__header">
        <span className="chat__avatar" aria-hidden="true">
          HB
        </span>
        <div className="chat__meta">
          <span className="chat__name">Haulbot Agent</span>
          <span className="chat__channel">bot</span>
        </div>
      </div>
      <div className="chat__body">
        {messages.map((m, i) => (
          <div key={i} className={`chat__row chat__row--${m.from}`}>
            <div className="chat__stack">
              <div className={`chat__bubble chat__bubble--${m.from}`}>
                <span className={`chat__text${m.mono ? " chat__text--mono" : ""}`}>{m.text}</span>
                <span className="chat__stamp">
                  <span className="chat__time">{m.time}</span>
                  {m.from === "driver" ? <DoubleCheck /> : null}
                </span>
              </div>
              {m.buttons ? (
                <div className="chat__keyboard">
                  {m.buttons.map((b) => (
                    <span key={b} className="chat__key">
                      {b}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const goalChat: ChatMessage[] = [
  { from: "driver", text: "/goal $8k this week", mono: true, time: "9:02 AM" },
  {
    from: "bot",
    text: "Goal set: $8,000 by Sunday.\nI'll plan lanes and run campaigns toward it — you approve the rules, I do the searching.",
    time: "9:02 AM",
  },
  { from: "driver", text: "/goal $5k from DFW, Atlanta by Thursday", mono: true, time: "9:03 AM" },
  {
    from: "bot",
    text: "Updated: $5,000 by Thursday, working DFW and Atlanta lanes.",
    time: "9:03 AM",
  },
];

const handoffChat: ChatMessage[] = [
  {
    from: "bot",
    text: "Load booked.\nTrip T-4821 · DFW → ATL\n$850 ($3.10/mi)\n\nWhen do you want your next load out of ATL?",
    buttons: ["+1 hour", "+3 hours", "Tomorrow 8am", "Custom time…"],
    time: "2:15 PM",
  },
  { from: "driver", text: "Tomorrow 8am", time: "2:16 PM" },
  {
    from: "bot",
    text: "Next leg queued: ATL → anywhere, ready tomorrow 8:00 AM.\nSend /complete when you deliver — I'll start scanning right on time.",
    time: "2:16 PM",
  },
];

const controlChat: ChatMessage[] = [
  { from: "driver", text: "/status", mono: true, time: "11:20 AM" },
  {
    from: "bot",
    text: "Active trip: T-4821 · DFW → ATL, delivering today\nQueued: ATL → anywhere, tomorrow 8:00 AM\nRules: min $2.50/mi · min $800",
    time: "11:20 AM",
  },
  { from: "driver", text: "/pause", mono: true, time: "11:21 AM" },
  {
    from: "bot",
    text: "Paused. Nothing gets booked until you send /resume.",
    time: "11:21 AM",
  },
];

const capabilities = [
  {
    id: "capability-goal",
    title: "Tell it what you need, in plain English",
    body:
      "Set a revenue goal or name your lanes. The agent turns it into searches on Amazon Relay and works toward it — no load-board tabs, no refreshing.",
    chat: goalChat,
  },
  {
    id: "capability-handoff",
    title: "Every booking lines up the next one",
    body:
      "The moment a load is booked, the bot asks when you want the next one out of your destination. Pick a time and the next leg is queued before you've even rolled.",
    chat: handoffChat,
  },
  {
    id: "capability-control",
    title: "You stay in control",
    body:
      "Check the full picture with one command. Pause anytime, resume anytime. Your minimum rate and payout are hard rules — the agent never books below them.",
    chat: controlChat,
  },
];

const steps = [
  {
    title: "Connect",
    body: "Subscribe, link your Telegram, and connect your Amazon Relay account from the portal. 2FA supported.",
  },
  {
    title: "Set your rules",
    body: "One message: origin, minimum rate, minimum payout. Or just describe your goal for the week.",
  },
  {
    title: "Drive",
    body: "Your agent scans the board, books loads that meet your rules, and pings you only when it matters.",
  },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
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
      <div className="marketing">
        <section className="hero">
          <div className="hero__copy">
            <p className="hero__kicker">
              <span className="hero__kicker-line" aria-hidden="true" />
              AI dispatch for solo Amazon Relay drivers
            </p>
            <h1 className="hero__title">
              Book loads
              <br />
              <span className="hero__title-accent">while you drive.</span>
            </h1>
            <p className="hero__lead">
              Send one Telegram message. A dedicated agent searches Amazon Relay, books loads that
              match your rules, and keeps your next leg queued — while you stay on the road.
            </p>
            <div className="hero__actions">
              <Button variant="primary" onClick={() => scrollToId("pricing")}>
                Get started — $199/mo
              </Button>
              <button
                type="button"
                className="hero__ghost"
                onClick={() => scrollToId("capabilities")}
              >
                See how it works
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <ul className="hero__trust">
              {["Cancel anytime", "Setup in minutes", "Runs 24/7"].map((t) => (
                <li key={t}>
                  <CheckMark />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="hero__demo">
            <HeroDemoVideo
              title="Starting a campaign and getting a load booked"
              fallback={
                <ChatMock
                  title="Starting a campaign and getting a load booked"
                  messages={heroChat}
                />
              }
            />
          </div>
        </section>

        <section className="problem">
          <h2 className="problem__title">Driving and dispatching don't mix.</h2>
          <p className="problem__body">
            The best loads on Amazon Relay are gone in seconds. You either watch the board all day
            or you keep your wheels turning — you can't do both. So you refresh at every stop, book
            in a hurry, and still leave money on the table.
          </p>
        </section>

        <section className="capabilities" id="capabilities">
          <p className="section__eyebrow">
            <span className="section__eyebrow-tick" aria-hidden="true" />
            <span className="section__eyebrow-num">01</span> — In action
          </p>
          <h2 className="section__title">What your agent can do</h2>
          <p className="section__lead">
            Real commands, real conversations — this is what dispatching from your cab looks like.
          </p>
          <div className="capabilities__list">
            {capabilities.map((c, i) => (
              <div key={c.id} className={`capability${i % 2 === 1 ? " capability--flipped" : ""}`}>
                <div className="capability__copy">
                  <h3 className="capability__title">{c.title}</h3>
                  <p className="capability__body">{c.body}</p>
                </div>
                <div className="capability__demo">
                  <ChatMock title={c.title} messages={c.chat} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="steps">
          <div className="steps__head">
            <p className="section__eyebrow">
              <span className="section__eyebrow-tick" aria-hidden="true" />
              <span className="section__eyebrow-num">02</span> — Getting started
            </p>
            <h2 className="section__title">Up and running in three steps</h2>
            <p className="section__lead">
              No dashboards to learn. Connect once, set your rules, and let the agent work.
            </p>
          </div>
          <ol className="steps__grid">
            {steps.map((s, i) => (
              <li key={s.title} className="steps__item">
                <span className="steps__number" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="steps__title">{s.title}</h3>
                <p className="steps__body">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pricing" id="pricing">
          <div className="pricing__card">
            <span className="pricing__badge">Everything included</span>
            <p className="pricing__eyebrow">Simple pricing</p>
            <p className="pricing__price">
              $199<span className="pricing__period">/month</span>
            </p>
            <p className="pricing__anchor">
              A dispatch service takes 5–10% of everything you gross. This is a flat $199 a month — one booked load can cover it.
            </p>
            <ul className="pricing__features">
              <li>A dedicated dispatch agent, running 24/7</li>
              <li>Unlimited campaigns, goals, and bookings</li>
              <li>Full control from Telegram — pause or cancel anytime</li>
            </ul>

            {canceled ? (
              <p className="pricing__notice">Checkout canceled. Try again when ready.</p>
            ) : null}

            <div className="pricing__form">
              <label className="pricing__label" htmlFor="subscribe-email">
                Email for your account
              </label>
              <input
                id="subscribe-email"
                className="pricing__input"
                type="email"
                placeholder="you@carrier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              {error ? <p className="pricing__error">{error}</p> : null}
              <Button
                variant="primary"
                disabled={loading || !email.includes("@")}
                onClick={handleSubscribe}
              >
                {loading ? "Redirecting…" : "Subscribe — $199/mo"}
              </Button>
              <p className="pricing__reassure">No contract · Cancel anytime</p>
            </div>
            <p className="pricing__footnote">
              Already subscribed? <a href="/solo">Open your portal</a> to finish setup.
            </p>
          </div>
        </section>

        <footer className="marketing__footer">
          <p>Haulbot — AI dispatch for Amazon Relay owner-operators.</p>
          <p className="marketing__fineprint">Not affiliated with or endorsed by Amazon.</p>
        </footer>
      </div>
    </SiteLayout>
  );
}
