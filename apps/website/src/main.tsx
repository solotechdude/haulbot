import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { GoogleAnalytics } from "./analytics/GoogleAnalytics";
import { MarketingPage } from "./pages/MarketingPage";
import { SoloPortalPage } from "./pages/SoloPortalPage";
import { SignInPage } from "./pages/SignInPage";
import { AdminPage } from "./pages/AdminPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleAnalytics />
      <Routes>
        <Route path="/" element={<MarketingPage />} />
        <Route path="/solo" element={<SoloPortalPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
