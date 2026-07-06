/** Bump when Terms of Service change; checkout must send this version. */
export const TERMS_VERSION = "2026-07-05";

export const LEGAL_ENTITY = {
  name: "Haulbot LLC",
  governingLawState: "Delaware",
  address: {
    line1: "PO Box 12345",
    city: "Newark",
    state: "DE",
    zip: "19711",
  },
  supportEmail: "support@haulbot.online",
} as const;

export const SUBSCRIPTION_PRICE_USD = 199;

export function formatLegalAddress(): string {
  const { address } = LEGAL_ENTITY;
  return `${address.line1}, ${address.city}, ${address.state} ${address.zip}`;
}
