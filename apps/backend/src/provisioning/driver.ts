/**
 * Dedicated Environment drivers. PROVISIONER=aws uses AWS WorkSpaces Secure
 * Browser (one portal per Driver); anything else uses the dev stub.
 */

export interface ProvisionedEnvironmentInfo {
  environmentId: string;
  provider: "dev" | "aws";
  portalArn?: string;
  portalEndpoint?: string;
}

export interface EnvironmentDriver {
  create(userId: string): Promise<ProvisionedEnvironmentInfo>;
  destroy(info: ProvisionedEnvironmentInfo): Promise<void>;
}

export async function getEnvironmentDriver(): Promise<EnvironmentDriver> {
  if (process.env.PROVISIONER === "aws") {
    const { awsWorkspacesWebDriver } = await import("./aws-workspaces-web");
    return awsWorkspacesWebDriver;
  }
  const { devEnvironmentDriver } = await import("./dev-driver");
  return devEnvironmentDriver;
}
