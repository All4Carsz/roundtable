import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { resolveApiKey } from "./api-keys";
import type { BrainRole, ProviderId, ProviderStatus } from "./types";

const DEFAULT_MODELS: Record<ProviderId, string> = {
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

const ROLE_DEFAULT_PROVIDER: Record<BrainRole, ProviderId> = {
  architect: "openai",
  coder: "anthropic",
  redteam: "xai",
  researcher: "google",
};

export function getProviderStatuses(): ProviderStatus[] {
  return [
    {
      id: "openai",
      label: "OpenAI",
      configured: Boolean(resolveApiKey("openai")),
      defaultModel: DEFAULT_MODELS.openai,
    },
    {
      id: "anthropic",
      label: "Anthropic",
      configured: Boolean(resolveApiKey("anthropic")),
      defaultModel: DEFAULT_MODELS.anthropic,
    },
    {
      id: "google",
      label: "Google",
      configured: Boolean(resolveApiKey("google")),
      defaultModel: DEFAULT_MODELS.google,
    },
    {
      id: "xai",
      label: "xAI",
      configured: Boolean(resolveApiKey("xai")),
      defaultModel: DEFAULT_MODELS.xai,
    },
  ];
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
  if (!["openai", "anthropic", "google", "xai"].includes(provider)) return null;
  return { provider: provider as ProviderId, model };
}

export function resolveBrainModel(
  role: BrainRole,
  preferredOrder: ProviderId[],
): { provider: ProviderId; model: string } | null {
  const override = process.env[ROLE_ENV[role]]?.trim();
  if (override) {
    const parsed = parseModelRef(override);
    if (parsed && configuredProviders().includes(parsed.provider)) {
      return parsed;
    }
  }

  const available = configuredProviders();
  if (available.length === 0) return null;

  const preferred = ROLE_DEFAULT_PROVIDER[role];
  const order = [preferred, ...preferredOrder, ...available];
  for (const provider of order) {
    if (available.includes(provider)) {
      return { provider, model: DEFAULT_MODELS[provider] };
    }
  }

  return { provider: available[0], model: DEFAULT_MODELS[available[0]] };
}

export function getLanguageModel(provider: ProviderId, model: string): LanguageModel {
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
  const rates: Record<ProviderId, { in: number; out: number }> = {
    openai: { in: 2.5 / 1e6, out: 10 / 1e6 },
    anthropic: { in: 3 / 1e6, out: 15 / 1e6 },
    google: { in: 1.25 / 1e6, out: 10 / 1e6 },
    xai: { in: 3 / 1e6, out: 15 / 1e6 },
  };
  const r = rates[provider];
  return inputTokens * r.in + outputTokens * r.out;
}
