import {
  AssociateBrowserSettingsCommand,
  AssociateNetworkSettingsCommand,
  AssociateUserSettingsCommand,
  CreatePortalCommand,
  DeletePortalCommand,
  WorkSpacesWebClient,
} from "@aws-sdk/client-workspaces-web";
import type { EnvironmentDriver, ProvisionedEnvironmentInfo } from "./driver";

/**
 * AWS WorkSpaces Secure Browser — one portal per Driver for the life of
 * their subscription. Browser settings (with the force-installed SOLO
 * extension policy), network settings, and user settings are created once
 * per AWS account and referenced by ARN:
 *
 *   AWS_REGION
 *   WSW_BROWSER_SETTINGS_ARN   browser policy incl. ExtensionInstallForcelist
 *   WSW_NETWORK_SETTINGS_ARN   VPC/subnets/security groups
 *   WSW_USER_SETTINGS_ARN      clipboard/download/session limits
 */

let client: WorkSpacesWebClient | null = null;

function getClient(): WorkSpacesWebClient {
  if (!client) {
    client = new WorkSpacesWebClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return client;
}

export const awsWorkspacesWebDriver: EnvironmentDriver = {
  async create(userId: string): Promise<ProvisionedEnvironmentInfo> {
    const wsw = getClient();

    const portal = await wsw.send(
      new CreatePortalCommand({
        displayName: `solo-${userId.slice(0, 8)}`,
        instanceType: "standard.regular",
        maxConcurrentSessions: 1,
        tags: [
          { Key: "product", Value: "haulbot" },
          { Key: "userId", Value: userId },
        ],
      }),
    );

    const portalArn = portal.portalArn;
    if (!portalArn) throw new Error("WSW_PORTAL_ARN_MISSING");

    const browserSettingsArn = process.env.WSW_BROWSER_SETTINGS_ARN;
    const networkSettingsArn = process.env.WSW_NETWORK_SETTINGS_ARN;
    const userSettingsArn = process.env.WSW_USER_SETTINGS_ARN;

    if (browserSettingsArn) {
      await wsw.send(new AssociateBrowserSettingsCommand({ portalArn, browserSettingsArn }));
    }
    if (networkSettingsArn) {
      await wsw.send(new AssociateNetworkSettingsCommand({ portalArn, networkSettingsArn }));
    }
    if (userSettingsArn) {
      await wsw.send(new AssociateUserSettingsCommand({ portalArn, userSettingsArn }));
    }

    return {
      environmentId: portalArn.split("/").pop() ?? portalArn,
      provider: "aws",
      portalArn,
      portalEndpoint: portal.portalEndpoint,
    };
  },

  async destroy(info: ProvisionedEnvironmentInfo): Promise<void> {
    if (!info.portalArn) return;
    await getClient().send(new DeletePortalCommand({ portalArn: info.portalArn }));
  },
};
