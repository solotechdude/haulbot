import { describe, expect, test } from "bun:test";
import { formatCampaignStatusMessage } from "@haulbot/shared";
import { driverMessageForAccessIssue } from "./access";

describe("driverMessageForAccessIssue", () => {
  test("permission_denied tells the driver about carrier admin and auto-resume", () => {
    const msg = driverMessageForAccessIssue("permission_denied");
    expect(msg).toContain("do not have permissions");
    expect(msg).toContain("carrier administrator");
    expect(msg).toContain("resumes automatically");
  });

  test("2fa_required points at the /2fa command", () => {
    expect(driverMessageForAccessIssue("2fa_required")).toContain("/2fa 123456");
  });

  test("login_failed points at /connect_relay", () => {
    expect(driverMessageForAccessIssue("login_failed")).toContain("/connect_relay");
  });

  test("session_expired tells the driver to sign in and promises auto-resume", () => {
    const msg = driverMessageForAccessIssue("session_expired");
    expect(msg).toContain("signed out");
    expect(msg.toLowerCase()).toContain("sign back in");
    expect(msg).toContain("resumes automatically");
  });
});

describe("campaign status pin while blocked", () => {
  test("shows blocked line instead of work state", () => {
    const text = formatCampaignStatusMessage({
      origin: "BRAMPTON",
      destination: "BRAMPTON",
      armed: true,
      relayAccessKind: "permission_denied",
      agentStatus: {
        relayWorkState: "scanning",
        armed: true,
        updatedAt: new Date().toISOString(),
      },
    });
    expect(text).toContain("Relay access blocked");
    expect(text).not.toContain("Scanning");
  });
});
