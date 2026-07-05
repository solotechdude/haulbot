import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGoogleAnalytics, sanitizePagePath, trackPageView } from "./gtag";

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    initGoogleAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(sanitizePagePath(location.pathname, location.search));
  }, [location.pathname, location.search]);

  return null;
}
