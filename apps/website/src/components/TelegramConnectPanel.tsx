import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "./ui/Button";
import "./TelegramConnectPanel.css";

interface TelegramConnectPanelProps {
  userId: string;
}

const SESSION_TOKEN_KEY = "haulbot_session_token";

const EXPECTED_BOT =
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "agent_haulbot";

function authHeaders(userId: string): HeadersInit {
  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
  if (sessionToken) return { Authorization: `Bearer ${sessionToken}` };
  return { "x-user-id": userId };
}
function botUsernameFromUrl(url: string): string | null {
  const match = url.match(/t\.me\/([^/?]+)/i);
  return match?.[1] ?? null;
}

function openTelegram(url: string) {
  window.open(url, "_blank", "noopener");
}

export function TelegramConnectPanel({ userId }: TelegramConnectPanelProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadUrl = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/onboarding/telegram-deeplink", {
        headers: authHeaders(userId),
      });
      if (!res.ok) throw new Error("Failed to get Telegram link");
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
    } catch {
      setUrl(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadUrl();
    const onFocus = () => void loadUrl();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadUrl, userId]);

  if (loading && !url) {
    return <p className="telegram-connect__loading">Loading Telegram link…</p>;
  }

  if (error || !url) {
    return (
      <div className="telegram-connect__copy">
        <p className="telegram-connect__hint">Could not load your Telegram link.</p>
        <Button variant="secondary" className="telegram-connect__btn" onClick={() => void loadUrl()}>
          Try again
        </Button>
      </div>
    );
  }

  const botUsername = botUsernameFromUrl(url) ?? EXPECTED_BOT;

  return (
    <div className="telegram-connect">
      <div className="telegram-connect__qr" aria-hidden="true">
        <QRCodeSVG value={url} size={148} level="M" bgColor="#ffffff" fgColor="#0a0a0a" />
      </div>
      <div className="telegram-connect__copy">
        <p className="telegram-connect__headline">Scan with your phone</p>
        <p className="telegram-connect__bot">Opens @{botUsername} in Telegram</p>
        <p className="telegram-connect__hint">
          Press Start in Telegram → return here. This page updates automatically.
        </p>
        <Button
          variant="secondary"
          className="telegram-connect__btn telegram-connect__btn--desktop"
          onClick={() => openTelegram(url)}
        >
          Open in Telegram
        </Button>
        <Button
          variant="primary"
          className="telegram-connect__btn telegram-connect__btn--mobile"
          onClick={() => openTelegram(url)}
        >
          Connect Telegram
        </Button>
      </div>
    </div>
  );
}
