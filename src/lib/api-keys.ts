import { AsyncLocalStorage } from "async_hooks";
import type { BuiltinProviderId, CustomAiProvider, ProviderId } from "./types";
import {
  BUILTIN_PROVIDERS,
  CUSTOM_PROVIDERS_HEADER,
  ENV_MAP,
  HEADER_MAP,
  type ApiKeys,
} from "./keys-shared";

export type { ApiKeys } from "./keys-shared";
export { HEADER_MAP, ENV_MAP, CUSTOM_PROVIDERS_HEADER, BUILTIN_PROVIDERS } from "./keys-shared";

type RequestAuthContext = {
  keys: ApiKeys;
  customProviders: CustomAiProvider[];
};

const storage = new AsyncLocalStorage<RequestAuthContext>();

function emptyContext(): RequestAuthContext {
  return { keys: {}, customProviders: [] };
}

export function parseApiKeysFromHeaders(headers: Headers): ApiKeys {
  const keys: ApiKeys = {};
  for (const [provider, header] of Object.entries(HEADER_MAP) as Array<
    [BuiltinProviderId, string]
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
  for (const provider of BUILTIN_PROVIDERS) {
    const value = raw[provider] ?? raw[`${provider}Key`] ?? raw[ENV_MAP[provider]];
    if (typeof value === "string" && value.trim()) {
      keys[provider] = value.trim();
    }
  }
  return keys;
}

export function parseCustomProvidersFromHeaders(headers: Headers): CustomAiProvider[] {
  const raw = headers.get(CUSTOM_PROVIDERS_HEADER);
  if (!raw) return [];
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    return normalizeCustomProviders(JSON.parse(decoded));
  } catch {
    try {
      return normalizeCustomProviders(JSON.parse(raw));
    } catch {
      return [];
    }
  }
}

export function parseCustomProvidersFromBody(body: unknown): CustomAiProvider[] {
  if (!body || typeof body !== "object") return [];
  const raw = body as Record<string, unknown>;
  return normalizeCustomProviders(raw.customProviders);
}

export function normalizeCustomProviders(input: unknown): CustomAiProvider[] {
  if (!Array.isArray(input)) return [];
  const out: CustomAiProvider[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const p = item as Partial<CustomAiProvider>;
    const id = String(p.id || "").trim();
    const name = String(p.name || "").trim();
    const baseUrl = String(p.baseUrl || "").trim().replace(/\/+$/, "");
    const apiKey = String(p.apiKey || "").trim();
    const model = String(p.model || "").trim();
    if (!id || !name || !baseUrl || !apiKey || !model) continue;
    if (!id.startsWith("custom_")) continue;
    out.push({
      id,
      name,
      baseUrl,
      apiKey,
      model,
      assignToRole: p.assignToRole || null,
      joinRoundTable: Boolean(p.joinRoundTable),
      systemPrompt: p.systemPrompt?.trim() || undefined,
      enabled: p.enabled !== false,
    });
  }
  return out;
}

export function runWithApiKeys<T>(
  keys: ApiKeys,
  fn: () => T,
  customProviders: CustomAiProvider[] = [],
): T {
  return storage.run({ keys, customProviders }, fn);
}

export function getRequestApiKeys(): ApiKeys {
  return storage.getStore()?.keys || {};
}

export function getRequestCustomProviders(): CustomAiProvider[] {
  return (storage.getStore()?.customProviders || []).filter((p) => p.enabled);
}

export function resolveApiKey(provider: ProviderId): string | undefined {
  if (provider.startsWith("custom_")) {
    return getRequestCustomProviders().find((p) => p.id === provider)?.apiKey;
  }
  if ((BUILTIN_PROVIDERS as string[]).includes(provider)) {
    const builtin = provider as BuiltinProviderId;
    const fromRequest = getRequestApiKeys()[builtin]?.trim();
    if (fromRequest) return fromRequest;
    return process.env[ENV_MAP[builtin]]?.trim() || undefined;
  }
  return undefined;
}

export function resolveCustomProvider(providerId: string): CustomAiProvider | undefined {
  return getRequestCustomProviders().find((p) => p.id === providerId);
}

export function mergeApiKeys(...bags: ApiKeys[]): ApiKeys {
  const out: ApiKeys = {};
  for (const bag of bags) {
    for (const [k, v] of Object.entries(bag) as Array<
      [BuiltinProviderId, string | undefined]
    >) {
      if (v?.trim()) out[k] = v.trim();
    }
  }
  return out;
}

export function mergeCustomProviders(
  ...bags: CustomAiProvider[][]
): CustomAiProvider[] {
  const map = new Map<string, CustomAiProvider>();
  for (const bag of bags) {
    for (const p of bag) map.set(p.id, p);
  }
  return [...map.values()];
}
