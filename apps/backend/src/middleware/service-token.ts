import type { Context, Next } from "hono";

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
