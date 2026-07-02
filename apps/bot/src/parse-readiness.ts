/** Parse driver free-text into ISO readiness time */
export function parseReadinessText(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const now = new Date();

  if (/^now$/i.test(text)) return now.toISOString();

  const relative = text.match(/^\+(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins)$/i);
  if (relative) {
    const n = Number(relative[1]);
    const unit = relative[2]!.toLowerCase();
    const d = new Date(now);
    if (unit.startsWith("h")) d.setHours(d.getHours() + n);
    else d.setMinutes(d.getMinutes() + n);
    return d.toISOString();
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed) && parsed > now.getTime() - 60_000) {
    return new Date(parsed).toISOString();
  }

  const tomorrow = text.match(/^tomorrow\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (tomorrow) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    let hour = Number(tomorrow[1]);
    const min = tomorrow[2] ? Number(tomorrow[2]) : 0;
    const ampm = tomorrow[3]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    d.setHours(hour, min, 0, 0);
    return d.toISOString();
  }

  return null;
}
