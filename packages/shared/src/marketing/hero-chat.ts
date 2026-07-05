/** Marketing hero demo — SSOT for website ChatMock + Remotion composition. */
export type MarketingChatMessage = {
  from: "driver" | "bot";
  text: string;
  mono?: boolean;
  buttons?: string[];
  time: string;
};

export const heroChat: MarketingChatMessage[] = [
  { from: "driver", text: "/campaign DFW 2.5 800", mono: true, time: "3:41 PM" },
  {
    from: "bot",
    text: "Campaign: DFW → anywhere\nMin $2.50/mi · Min $800 payout · 50 mi radius",
    buttons: ["Start searching", "Add filters"],
    time: "3:41 PM",
  },
  {
    from: "bot",
    text: "Agent armed — scanning loads…\nLast scan (3:42 PM): 12 loads, no match yet",
    time: "3:42 PM",
  },
  {
    from: "bot",
    text: "Load booked.\nDFW → ATL · $850 ($3.10/mi)\nAssign driver in Relay when ready.",
    time: "3:58 PM",
  },
];

export function heroScanningLine(loadCount: number): string {
  return `Agent armed — scanning loads…\nLast scan (3:42 PM): ${loadCount} loads, no match yet`;
}
