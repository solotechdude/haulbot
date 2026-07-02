import { randomUUID } from "node:crypto";
import type { EnvironmentDriver, ProvisionedEnvironmentInfo } from "./driver";

export const devEnvironmentDriver: EnvironmentDriver = {
  async create(): Promise<ProvisionedEnvironmentInfo> {
    return { environmentId: randomUUID(), provider: "dev" };
  },

  async destroy(): Promise<void> {
    // Nothing to tear down for the dev stub
  },
};
