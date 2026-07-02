import type { Context, Next } from "hono";
import { verifySessionToken } from "../auth/session";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Bot worker → backend. Shared secret in x-service-token. */
export function requireServiceToken() {
  return async (c: Context, next: Next) => {
    const expected = process.env.DISPATCHER_SERVICE_TOKEN;
    const token = c.req.header("x-service-token");
    if (!expected || token !== expected) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }
    await next();
  };
}

/**
 * Extension → backend. Requires x-user-id plus x-service-token matching
 * EXTENSION_SERVICE_TOKEN. Until that env var is set the token check is
 * skipped (migration window for extensions deployed before auth rollout).
 */
export function requireExtensionAuth() {
  return async (c: Context, next: Next) => {
    const userId = c.req.header("x-user-id");
    if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

    const expected = process.env.EXTENSION_SERVICE_TOKEN;
    if (expected) {
      const token = c.req.header("x-service-token");
      if (token !== expected) return c.json({ error: "UNAUTHORIZED" }, 401);
    } else if (isProduction()) {
      console.warn("[auth] EXTENSION_SERVICE_TOKEN unset — dispatcher API running unauthenticated");
    }

    c.set("userId", userId);
    await next();
  };
}

/** Product Admin → backend. Fails closed when ADMIN_TOKEN is unset. */
export function requireAdminToken() {
  return async (c: Context, next: Next) => {
    const expected = process.env.ADMIN_TOKEN;
    const token = c.req.header("x-admin-token");
    if (!expected || token !== expected) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }
    await next();
  };
}

/**
 * Website → backend. Requires Authorization: Bearer <session token> issued
 * by the magic-link exchange. Outside production a bare x-user-id header is
 * accepted so the dev stub flow keeps working.
 */
export function requireDriverSession() {
  return async (c: Context, next: Next) => {
    const auth = c.req.header("authorization");
    if (auth?.startsWith("Bearer ")) {
      const userId = verifySessionToken(auth.slice("Bearer ".length));
      if (userId) {
        c.set("userId", userId);
        return next();
      }
      return c.json({ error: "SESSION_EXPIRED" }, 401);
    }

    if (!isProduction()) {
      const devUserId = c.req.header("x-user-id");
      if (devUserId) {
        c.set("userId", devUserId);
        return next();
      }
    }

    return c.json({ error: "UNAUTHORIZED" }, 401);
  };
}
