import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./SiteLayout.css";

interface SiteLayoutProps {
  children: React.ReactNode;
  /** Optional modifier for `<main>` — e.g. tighter padding on /solo */
  mainClassName?: string;
}

const SESSION_KEY = "haulbot_user_id";
const SESSION_TOKEN_KEY = "haulbot_session_token";

/** Bearer session token when present; x-user-id works only against dev backends */
function authHeaders(): HeadersInit {
  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
  if (sessionToken) return { Authorization: `Bearer ${sessionToken}` };
  return { "x-user-id": localStorage.getItem(SESSION_KEY) ?? "" };
}

function isLoggedIn(): boolean {
  if (localStorage.getItem(SESSION_TOKEN_KEY)) return true;
  return Boolean(import.meta.env.DEV && localStorage.getItem(SESSION_KEY));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function SiteLayout({ children, mainClassName }: SiteLayoutProps) {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);

    let active = true;
    fetch("/api/onboarding/status", { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) {
          clearSession();
          if (active) {
            setLoggedIn(false);
            setEmail(null);
          }
          return null;
        }
        if (!res.ok) return null;
        return res.json() as Promise<{ email?: string }>;
      })
      .then((profile) => {
        if (active && profile?.email) setEmail(profile.email);
      })
      .catch(() => {
        /* resilient: keep logged-in state, avatar falls back to "•" */
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function onMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        avatarRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function openBillingPortal() {
    setMenuOpen(false);
    try {
      const res = await fetch("/api/billing/portal-session", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.warn("Billing portal unavailable");
      }
    } catch {
      console.warn("Billing portal request failed");
    }
  }

  function signOut() {
    setMenuOpen(false);
    clearSession();
    window.location.href = "/";
  }

  const initial = email ? email.trim().charAt(0).toUpperCase() : "•";

  return (
    <div className="site">
      <header className="site__header">
        <div className="site__header-inner">
          <Link to="/" className="site__logo" aria-label="Haulbot home">
            <span className="site__logo-badge" aria-hidden="true">H</span>
            <span className="site__logo-word">
              Haul<span className="site__logo-mark">bot</span>
            </span>
          </Link>
          <nav className="site__nav">
            {loggedIn ? (
              <div className="site__account" ref={menuRef}>
                <button
                  ref={avatarRef}
                  type="button"
                  className="site__avatar"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls="site-account-menu"
                  aria-label="Account menu"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {initial}
                </button>
                {menuOpen ? (
                  <div className="site__menu" id="site-account-menu" role="menu">
                    <Link
                      to="/solo"
                      role="menuitem"
                      className="site__menu-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      Portal
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="site__menu-item"
                      onClick={openBillingPortal}
                    >
                      Manage billing
                    </button>
                    <div className="site__menu-sep" role="separator" />
                    <button
                      type="button"
                      role="menuitem"
                      className="site__menu-item"
                      onClick={signOut}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link to="/sign-in">Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      <main className={mainClassName ? `site__main ${mainClassName}` : "site__main"}>{children}</main>
    </div>
  );
}
