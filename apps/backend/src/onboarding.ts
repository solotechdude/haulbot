import type { AccountSetupPhase, DriverProfile, OnboardingStep } from "@haulbot/shared";
import { getDispatchState } from "./db";

export function resolveAccountSetupPhase(input: {
  hasSubscription: boolean;
  provisionState: string | null | undefined;
}): AccountSetupPhase {
  if (!input.hasSubscription) return "awaiting_subscription";
  if (input.provisionState === "ready") return "complete";
  if (input.provisionState === "failed") return "failed";
  return "provisioning";
}

export function resolveOnboardingStep(input: {
  hasSubscription: boolean;
  environmentReady: boolean;
  telegramLinked: boolean;
  relay2faPending: boolean;
  relayReady: boolean;
  agentActive: boolean;
}): OnboardingStep {
  if (!input.hasSubscription) return "subscribed";
  if (!input.environmentReady) return "subscribed";
  if (!input.telegramLinked) return "environment_ready";
  if (input.relay2faPending) return "relay_2fa_required";
  if (!input.relayReady) return "telegram_linked";
  if (!input.agentActive) return "relay_ready";
  return "active";
}

export async function getDriverProfile(userId: string): Promise<DriverProfile | null> {
  const { getDb } = await import("./db");
  const db = await getDb();

  const user = await db.collection("users").findOne({ id: userId });
  if (!user) return null;

  const subscription = await db.collection("subscriptions").findOne({ userId, status: "active" });
  const telegram = await db.collection("telegram_links").findOne({ userId });
  const env = await db.collection("provisioned_environments").findOne({ userId });
  const dispatch = await getDispatchState(userId);

  const telegramLinked = Boolean(telegram && !telegram.devStub && !String(telegram.telegramChatId).startsWith("dev-"));

  const hasSubscription = Boolean(subscription);
  const provisionState = env?.provisionState ? String(env.provisionState) : null;

  const onboardingStep = resolveOnboardingStep({
    hasSubscription,
    environmentReady: provisionState === "ready",
    telegramLinked,
    relay2faPending: Boolean(user.relay2faPending),
    relayReady: Boolean(user.relayReadyAt),
    agentActive: Boolean(dispatch?.heartbeatAt && !dispatch?.paused),
  });

  const accountSetupPhase = resolveAccountSetupPhase({ hasSubscription, provisionState });

  return {
    userId,
    email: String(user.email),
    onboardingStep,
    accountSetupPhase,
    telegramLinked,
    paused: dispatch?.paused ?? false,
  };
}
