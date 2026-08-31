import { AsyncLocalStorage } from "async_hooks";
import type { ProviderId } from "./types";
import { ENV_MAP, HEADER_MAP, type ApiKeys } from "./keys-shared";

export type { ApiKeys } from "./keys-shared";
export { HEADER_MAP, ENV_MAP } from "./keys-shared";

const storage = new AsyncLocalStorage<ApiKeys>();

export function parseApiKeysFromHeaders(headers: Headers): ApiKeys {
  const keys: ApiKeys = {};
  for (const [provider, header] of Object.entries(HEADER_MAP) as Array<
    [ProviderId, string]
  >) {
    const value = headers.get(header)?.trim();
    if (value) keys[provider] = value;
  }
  return keys;
}

export function parseApiKeysFromBody(body: unknown): ApiKeys {
  if (!body || typeof body !== "object") return {};
  const raw = body as Record<string, unknown>;
  const keys: ApiKeys = {};
  for (const provider of Object.keys(ENV_MAP) as ProviderId[]) {
    const value = raw[provider] ?? raw[`${provider}Key`] ?? raw[ENV_MAP[provider]];
    if (typeof value === "string" && value.trim()) {
      keys[provider] = value.trim();
    }
  }
  return keys;
}

export function runWithApiKeys<T>(keys: ApiKeys, fn: () => T): T {
  return storage.run(keys, fn);
}

export function getRequestApiKeys(): ApiKeys {
  return storage.getStore() || {};
}

export function resolveApiKey(provider: ProviderId): string | undefined {
  const fromRequest = getRequestApiKeys()[provider]?.trim();
  if (fromRequest) return fromRequest;
  return process.env[ENV_MAP[provider]]?.trim() || undefined;
}

export function mergeApiKeys(...bags: ApiKeys[]): ApiKeys {
  const out: ApiKeys = {};
  for (const bag of bags) {
    for (const [k, v] of Object.entries(bag) as Array<[ProviderId, string | undefined]>) {
      if (v?.trim()) out[k] = v.trim();
    }
  }
  return out;
}
