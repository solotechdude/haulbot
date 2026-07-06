declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "";

let initialized = false;

export function isGoogleAnalyticsEnabled(): boolean {
  return Boolean(MEASUREMENT_ID) && !import.meta.env.DEV;
}

function loadGtagScript(id: string): void {
  if (document.querySelector(`script[data-ga-id="${id}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  script.dataset.gaId = id;
  document.head.appendChild(script);
}

export function initGoogleAnalytics(): void {
  if (!isGoogleAnalyticsEnabled() || initialized) return;

  window.dataLayer = window.dataLayer ?? [];
  // gtag.js only processes dataLayer entries pushed as `arguments` objects.
  // Rest-param arrays queue locally but never emit /g/collect hits.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  } as typeof window.gtag;

  loadGtagScript(MEASUREMENT_ID);
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false });

  initialized = true;
}

/** Strip auth tokens and other sensitive query params before sending to GA. */
export function sanitizePagePath(pathname: string, search: string): string {
  if (!search) return pathname;

  const params = new URLSearchParams(search);
  for (const key of ["token", "session"]) {
    params.delete(key);
  }

  const remaining = params.toString();
  return remaining ? `${pathname}?${remaining}` : pathname;
}

export function trackPageView(pagePath: string): void {
  if (!isGoogleAnalyticsEnabled() || !initialized) return;
  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_title: document.title,
    send_to: MEASUREMENT_ID,
  });
}

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!isGoogleAnalyticsEnabled() || !initialized) return;
  window.gtag("event", eventName, {
    ...params,
    send_to: MEASUREMENT_ID,
  });
}

export function trackOnce(key: string, eventName: string, params?: Record<string, unknown>): void {
  const storageKey = `ga_once_${key}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    trackEvent(eventName, params);
    sessionStorage.setItem(storageKey, "1");
  } catch {
    trackEvent(eventName, params);
  }
}
