/** Shared bot formatting/parsing helpers — single home, no per-handler copies */

export function formatReadiness(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function readinessFromPreset(preset: string): string | null {
  const d = new Date();
  if (preset === "+1h") {
    d.setHours(d.getHours() + 1);
    return d.toISOString();
  }
  if (preset === "+3h") {
    d.setHours(d.getHours() + 3);
    return d.toISOString();
  }
  if (preset === "tomorrow8") {
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
  }
  return null;
}
