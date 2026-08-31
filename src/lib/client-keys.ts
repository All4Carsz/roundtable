"use client";

import type { BuiltinProviderId, CustomAiProvider } from "./types";
import {
  BUILTIN_PROVIDERS,
  CUSTOM_PROVIDERS_HEADER,
  HEADER_MAP,
  type ApiKeys,
} from "./keys-shared";

const STORAGE_KEY = "roundtable.apiKeys.v1";
const CUSTOM_STORAGE_KEY = "roundtable.customProviders.v1";

export const PROVIDER_META: Array<{
  id: BuiltinProviderId;
  label: string;
  placeholder: string;
  help: string;
}> = [
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "sk-...",
    help: "Architect (ברירת מחדל)",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    placeholder: "sk-ant-...",
    help: "Coder (ברירת מחדל)",
  },
  {
    id: "google",
    label: "Google Gemini",
    placeholder: "AIza...",
    help: "Researcher (ברירת מחדל)",
  },
  {
    id: "xai",
    label: "xAI Grok",
    placeholder: "xai-...",
    help: "Red Team (ברירת מחדל)",
  },
];

export const CUSTOM_PRESETS: Array<{
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  help: string;
}> = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4",
    help: "מאות מודלים דרך API אחד",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    help: "מודלים חזקים במחיר נמוך",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    help: "מהיר מאוד",
  },
  {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-large-latest",
    help: "Mistral Cloud",
  },
  {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    help: "מודלים פתוחים",
  },
  {
    id: "ollama",
    label: "Ollama (מקומי)",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.2",
    help: "רץ על המחשב שלך — בדרך כלל רק ב-localhost",
  },
  {
    id: "blank",
    label: "מותאם אישית",
    baseUrl: "https://api.example.com/v1",
    model: "my-model",
    help: "כל endpoint תואם OpenAI",
  },
];

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("roundtable-keys-changed"));
}

export function loadClientApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ApiKeys;
    const cleaned: ApiKeys = {};
    for (const id of BUILTIN_PROVIDERS) {
      const v = parsed[id]?.trim();
      if (v) cleaned[id] = v;
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function saveClientApiKeys(keys: ApiKeys): void {
  if (typeof window === "undefined") return;
  const cleaned: ApiKeys = {};
  for (const id of BUILTIN_PROVIDERS) {
    const value = keys[id]?.trim();
    if (value) cleaned[id] = value;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  notifyChanged();
}

export function clearClientApiKeys(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  notifyChanged();
}

export function loadCustomProviders(): CustomAiProvider[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomAiProvider[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        p.id.startsWith("custom_") &&
        p.name &&
        p.baseUrl &&
        p.apiKey &&
        p.model,
    );
  } catch {
    return [];
  }
}

export function saveCustomProviders(providers: CustomAiProvider[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(providers));
  notifyChanged();
}

export function clearCustomProviders(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CUSTOM_STORAGE_KEY);
  notifyChanged();
}

export function clientKeysConfiguredCount(keys?: ApiKeys): number {
  const k = keys ?? loadClientApiKeys();
  return Object.values(k).filter((v) => Boolean(v?.trim())).length;
}

export function clientAuthConfiguredCount(): number {
  return (
    clientKeysConfiguredCount() +
    loadCustomProviders().filter((p) => p.enabled !== false).length
  );
}

function encodeCustomProvidersHeader(providers: CustomAiProvider[]): string {
  const payload = JSON.stringify(providers);
  // base64url without Buffer (browser)
  const b64 = btoa(unescape(encodeURIComponent(payload)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return b64;
}

export function apiKeyHeaders(keys?: ApiKeys): Record<string, string> {
  const k = keys ?? loadClientApiKeys();
  const headers: Record<string, string> = {};
  for (const [provider, header] of Object.entries(HEADER_MAP) as Array<
    [BuiltinProviderId, string]
  >) {
    const value = k[provider]?.trim();
    if (value) headers[header] = value;
  }

  const customs = loadCustomProviders().filter((p) => p.enabled !== false);
  if (customs.length > 0) {
    headers[CUSTOM_PROVIDERS_HEADER] = encodeCustomProvidersHeader(customs);
  }
  return headers;
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const keyHeaders = apiKeyHeaders();
  for (const [k, v] of Object.entries(keyHeaders)) {
    headers.set(k, v);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Also embed custom providers in JSON bodies when possible
  let body = init.body;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const customs = loadCustomProviders().filter((p) => p.enabled !== false);
      body = JSON.stringify({
        ...loadClientApiKeys(),
        ...parsed,
        customProviders: customs,
      });
    } catch {
      // keep original body
    }
  }

  return fetch(input, { ...init, headers, body });
}

export function newCustomProviderId(): string {
  return `custom_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
