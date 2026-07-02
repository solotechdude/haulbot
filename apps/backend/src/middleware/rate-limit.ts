import type { Context, Next } from "hono";

/**
 * Fixed-window in-memory rate limiter for public endpoints (checkout,
 * magic-link exchange). Single backend instance per docs/infrastructure.md,
 * so no shared store is needed.
 */
export function rateLimit(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const now = Date.now();

    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
    } else {
      entry.count += 1;
      if (entry.count > options.max) {
        return c.json({ error: "RATE_LIMITED" }, 429);
      }
    }

    if (hits.size > 10_000) {
      for (const [key, value] of hits) {
        if (value.resetAt <= now) hits.delete(key);
      }
    }

    await next();
  };
}
