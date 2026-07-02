export interface ParsedHandoffCriteria {
  origin: string;
  destination: string;
  minRate?: number;
  minPayout?: number;
}

/**
 * Parse next-leg route/rules from driver free text.
 * Aligns with /campaign ORIGIN minRate minPayout — see docs/campaign-bot-flow.md
 */
export function parseHandoffCriteria(
  text: string,
  defaultOrigin: string,
): ParsedHandoffCriteria | null {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const originDefault = defaultOrigin.toUpperCase();

  if (parts.length === 1) {
    const token = parts[0]!.toUpperCase();
    if (/^ANYWHERE$/i.test(token)) {
      return { origin: originDefault, destination: originDefault };
    }
    return { origin: originDefault, destination: token };
  }

  if (parts.length === 3) {
    const minRate = Number(parts[1]);
    const minPayout = Number(parts[2]);
    if (Number.isFinite(minRate) && Number.isFinite(minPayout)) {
      const origin = parts[0]!.toUpperCase();
      return {
        origin,
        destination: origin,
        minRate,
        minPayout,
      };
    }
  }

  if (parts.length === 4) {
    const minRate = Number(parts[1]);
    const minPayout = Number(parts[2]);
    if (Number.isFinite(minRate) && Number.isFinite(minPayout)) {
      const origin = parts[0]!.toUpperCase();
      const destToken = parts[3]!.toUpperCase();
      return {
        origin,
        destination: /^ANYWHERE$/i.test(destToken) ? origin : destToken,
        minRate,
        minPayout,
      };
    }
  }

  if (parts.length >= 2) {
    const minRate = parts[2] != null ? Number(parts[2]) : undefined;
    const minPayout = parts[3] != null ? Number(parts[3]) : undefined;
    const origin = parts[0]!.toUpperCase();
    const destToken = parts[1]!.toUpperCase();
    return {
      origin,
      destination: /^ANYWHERE$/i.test(destToken) ? origin : destToken,
      minRate: Number.isFinite(minRate) ? minRate : undefined,
      minPayout: Number.isFinite(minPayout) ? minPayout : undefined,
    };
  }

  return null;
}
