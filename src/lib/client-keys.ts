"use client";

import type { ProviderId } from "./types";
import { HEADER_MAP, type ApiKeys } from "./keys-shared";

const STORAGE_KEY = "roundtable.apiKeys.v1";

export const PROVIDER_META: Array<{
  id: ProviderId;
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

export function loadClientApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ApiKeys;
    const cleaned: ApiKeys = {};
    for (const id of Object.keys(parsed) as ProviderId[]) {
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
  for (const [id, value] of Object.entries(keys) as Array<[ProviderId, string | undefined]>) {
    if (value?.trim()) cleaned[id] = value.trim();
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new Event("roundtable-keys-changed"));
}

export function clearClientApiKeys(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("roundtable-keys-changed"));
}

export function clientKeysConfiguredCount(keys?: ApiKeys): number {
  const k = keys ?? loadClientApiKeys();
  return Object.values(k).filter((v) => Boolean(v?.trim())).length;
}

export function apiKeyHeaders(keys?: ApiKeys): Record<string, string> {
  const k = keys ?? loadClientApiKeys();
  const headers: Record<string, string> = {};
  for (const [provider, header] of Object.entries(HEADER_MAP) as Array<
    [ProviderId, string]
  >) {
    const value = k[provider]?.trim();
    if (value) headers[header] = value;
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
  return fetch(input, { ...init, headers });
}
