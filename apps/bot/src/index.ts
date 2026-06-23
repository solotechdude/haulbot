const apiOrigin = process.env.SOLO_API_ORIGIN ?? "http://localhost:8080";
const token = process.env.DISPATCHER_SERVICE_TOKEN ?? "dev-dispatcher-token";

export {};

async function healthCheck() {
  const res = await fetch(`${apiOrigin}/health`);
  if (!res.ok) throw new Error(`Backend unhealthy: ${res.status}`);
  console.log("[bot] backend ok", await res.json());
}

console.log("[bot] Telegram worker stub — wire TELEGRAM_BOT_TOKEN for polling (Track 4 T1)");

await healthCheck().catch((err) => {
  console.warn("[bot] backend not reachable:", (err as Error).message);
});

console.log("[bot] service token configured:", Boolean(token));
