import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "../components/SiteLayout";
import { Button } from "../components/ui/Button";
import "./SignInPage.css";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = email.includes("@");
  const canSubmit = emailValid && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await fetch("/api/auth/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Non-revealing endpoint: any resolved response advances to the sent state.
      setSent(true);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSent(false);
    setError(null);
  }

  return (
    <SiteLayout>
      <div className="signin">
        <section className="signin__card">
          <p className="signin__eyebrow">
            <span className="signin__eyebrow-tick" />
            Sign in
          </p>

          {sent ? (
            <>
              <h1 className="signin__title">Check your email</h1>
              <p className="signin__subline">
                If an account exists for {email}, we&apos;ve sent a sign-in link. It expires in 7
                days.
              </p>
              <p className="signin__footer">
                Didn&apos;t get it?{" "}
                <button type="button" className="signin__link-btn" onClick={resetForm}>
                  Try another email
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="signin__title">Sign in to your account</h1>
              <p className="signin__subline">
                Enter your email and we&apos;ll send you a secure sign-in link.
              </p>

              <form className="signin__form" onSubmit={handleSubmit} noValidate>
                <label className="signin__label" htmlFor="signin-email">
                  Email
                </label>
                <input
                  id="signin-email"
                  className="signin__input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />

                <Button type="submit" variant="primary" disabled={!canSubmit}>
                  {submitting ? "Sending…" : "Email me a sign-in link"}
                </Button>

                {error ? (
                  <p className="signin__error" role="alert">
                    {error}
                  </p>
                ) : null}
              </form>

              <p className="signin__footer">
                Just subscribed? Use the link from your checkout email, or{" "}
                <Link to="/" className="signin__link">
                  go back home
                </Link>
                .
              </p>
            </>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
