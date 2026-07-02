/**
 * HashiCorp Vault KV v2 client. Configured via VAULT_ADDR + VAULT_TOKEN
 * (+ optional VAULT_KV_MOUNT, default "secret"). When unconfigured the
 * relay-secrets module falls back to its dev stub.
 */

function vaultAddr(): string | null {
  return process.env.VAULT_ADDR ?? null;
}

function vaultHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Vault-Token": process.env.VAULT_TOKEN ?? "",
  };
}

function mount(): string {
  return process.env.VAULT_KV_MOUNT ?? "secret";
}

export function isVaultConfigured(): boolean {
  return Boolean(process.env.VAULT_ADDR && process.env.VAULT_TOKEN);
}

export async function kvPut(path: string, data: Record<string, unknown>): Promise<void> {
  const addr = vaultAddr();
  if (!addr) throw new Error("VAULT_NOT_CONFIGURED");

  const res = await fetch(`${addr}/v1/${mount()}/data/${path}`, {
    method: "POST",
    headers: vaultHeaders(),
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`VAULT_WRITE_FAILED:${res.status}`);
}

export async function kvGet<T = Record<string, unknown>>(path: string): Promise<T | null> {
  const addr = vaultAddr();
  if (!addr) throw new Error("VAULT_NOT_CONFIGURED");

  const res = await fetch(`${addr}/v1/${mount()}/data/${path}`, {
    headers: vaultHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`VAULT_READ_FAILED:${res.status}`);

  const body = (await res.json()) as { data?: { data?: T } };
  return body.data?.data ?? null;
}

export async function kvDelete(path: string): Promise<void> {
  const addr = vaultAddr();
  if (!addr) throw new Error("VAULT_NOT_CONFIGURED");

  const res = await fetch(`${addr}/v1/${mount()}/data/${path}`, {
    method: "DELETE",
    headers: vaultHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`VAULT_DELETE_FAILED:${res.status}`);
}
