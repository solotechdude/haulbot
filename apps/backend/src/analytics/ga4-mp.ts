import { SUBSCRIPTION_PRICE_USD } from "@haulbot/shared";

const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID?.trim() ?? "";
const API_SECRET = process.env.GA4_API_SECRET?.trim() ?? "";

function isConfigured(): boolean {
  return Boolean(MEASUREMENT_ID && API_SECRET);
}

/** Server-side purchase event — survives tab close before /solo loads. */
export async function trackGa4Purchase(input: {
  userId: string;
  transactionId: string;
}): Promise<void> {
  if (!isConfigured()) return;

  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", MEASUREMENT_ID);
  url.searchParams.set("api_secret", API_SECRET);

  const body = {
    client_id: input.userId,
    user_id: input.userId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: input.transactionId,
          value: SUBSCRIPTION_PRICE_USD,
          currency: "USD",
          engagement_time_msec: "1",
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn("[ga4] mp purchase failed:", res.status);
    }
  } catch (err) {
    console.warn("[ga4] mp purchase error:", (err as Error).message);
  }
}
