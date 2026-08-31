import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import {
  getRequestCustomProviders,
  resolveApiKey,
  resolveCustomProvider,
} from "./api-keys";
import type {
  BrainRole,
  BuiltinProviderId,
  ProviderId,
  ProviderStatus,
} from "./types";

const DEFAULT_MODELS: Record<BuiltinProviderId, string> = {
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-pro",
  xai: "grok-3",
};

const ROLE_ENV: Record<BrainRole, string> = {
  architect: "ROUNDTABLE_ARCHITECT_MODEL",
  coder: "ROUNDTABLE_CODER_MODEL",
  redteam: "ROUNDTABLE_REDTEAM_MODEL",
  researcher: "ROUNDTABLE_RESEARCHER_MODEL",
};

const ROLE_DEFAULT_PROVIDER: Record<BrainRole, BuiltinProviderId> = {
  architect: "openai",
  coder: "anthropic",
  redteam: "xai",
  researcher: "google",
};

export function isBuiltinProvider(id: string): id is BuiltinProviderId {
  return id === "openai" || id === "anthropic" || id === "google" || id === "xai";
}

export function getProviderStatuses(): ProviderStatus[] {
  const builtin: ProviderStatus[] = [
    {
      id: "openai",
      label: "OpenAI",
      configured: Boolean(resolveApiKey("openai")),
      defaultModel: DEFAULT_MODELS.openai,
      kind: "builtin",
    },
    {
      id: "anthropic",
      label: "Anthropic",
      configured: Boolean(resolveApiKey("anthropic")),
      defaultModel: DEFAULT_MODELS.anthropic,
      kind: "builtin",
    },
    {
      id: "google",
      label: "Google",
      configured: Boolean(resolveApiKey("google")),
      defaultModel: DEFAULT_MODELS.google,
      kind: "builtin",
    },
    {
      id: "xai",
      label: "xAI",
      configured: Boolean(resolveApiKey("xai")),
      defaultModel: DEFAULT_MODELS.xai,
      kind: "builtin",
    },
  ];

  const custom: ProviderStatus[] = getRequestCustomProviders().map((p) => ({
    id: p.id,
    label: p.name,
    configured: true,
    defaultModel: p.model,
    kind: "custom" as const,
    baseUrl: p.baseUrl,
    assignToRole: p.assignToRole,
    joinRoundTable: p.joinRoundTable,
  }));

  return [...builtin, ...custom];
}

export function configuredProviders(): ProviderId[] {
  return getProviderStatuses()
    .filter((p) => p.configured)
    .map((p) => p.id);
}

function parseModelRef(ref: string): { provider: ProviderId; model: string } | null {
  const [provider, ...rest] = ref.split(":");
  const model = rest.join(":").trim();
  if (!provider || !model) return null;
  return { provider, model };
}

export function resolveBrainModel(
  role: BrainRole,
  preferredOrder: BuiltinProviderId[],
): { provider: ProviderId; model: string } | null {
  // 1) Custom provider explicitly assigned to this role
  const assignedCustom = getRequestCustomProviders().find(
    (p) => p.enabled && p.assignToRole === role,
  );
  if (assignedCustom) {
    return { provider: assignedCustom.id, model: assignedCustom.model };
  }

  // 2) Env override
  const override = process.env[ROLE_ENV[role]]?.trim();
  if (override) {
    const parsed = parseModelRef(override);
    if (parsed && configuredProviders().includes(parsed.provider)) {
      return parsed;
    }
  }

  const available = configuredProviders();
  if (available.length === 0) return null;

  // 3) Preferred builtin order, then any available (including custom)
  const preferred = ROLE_DEFAULT_PROVIDER[role];
  const order: ProviderId[] = [preferred, ...preferredOrder, ...available];
  for (const provider of order) {
    if (available.includes(provider)) {
      if (isBuiltinProvider(provider)) {
        return { provider, model: DEFAULT_MODELS[provider] };
      }
      const custom = resolveCustomProvider(provider);
      if (custom) return { provider: custom.id, model: custom.model };
    }
  }

  const first = available[0];
  if (isBuiltinProvider(first)) {
    return { provider: first, model: DEFAULT_MODELS[first] };
  }
  const custom = resolveCustomProvider(first);
  if (custom) return { provider: custom.id, model: custom.model };
  return null;
}

export function getLanguageModel(provider: ProviderId, model: string): LanguageModel {
  if (provider.startsWith("custom_")) {
    const custom = resolveCustomProvider(provider);
    if (!custom) throw new Error(`ספק מותאם לא נמצא: ${provider}`);
    const openai = createOpenAI({
      apiKey: custom.apiKey,
      baseURL: custom.baseUrl,
      name: custom.name,
    });
    return openai(model || custom.model);
  }

  if (!isBuiltinProvider(provider)) {
    throw new Error(`ספק לא מוכר: ${provider}`);
  }

  const apiKey = resolveApiKey(provider);
  if (!apiKey) {
    throw new Error(`חסר API key עבור ${provider}`);
  }

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model);
    }
    case "xai": {
      const xai = createXai({ apiKey });
      return xai(model);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

/** Rough USD estimates for Control Plane budgets (not billing-accurate). */
export function estimateCostUsd(
  provider: ProviderId,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!isBuiltinProvider(provider)) {
    // Generic estimate for custom OpenAI-compatible endpoints
    return inputTokens * (0.5 / 1e6) + outputTokens * (1.5 / 1e6);
  }
  const rates: Record<BuiltinProviderId, { in: number; out: number }> = {
    openai: { in: 2.5 / 1e6, out: 10 / 1e6 },
    anthropic: { in: 3 / 1e6, out: 15 / 1e6 },
    google: { in: 1.25 / 1e6, out: 10 / 1e6 },
    xai: { in: 3 / 1e6, out: 15 / 1e6 },
  };
  const r = rates[provider];
  return inputTokens * r.in + outputTokens * r.out;
}

export function providerDisplayName(provider: ProviderId): string {
  if (provider.startsWith("custom_")) {
    return resolveCustomProvider(provider)?.name || provider;
  }
  const labels: Record<BuiltinProviderId, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    xai: "xAI",
  };
  return isBuiltinProvider(provider) ? labels[provider] : provider;
}
