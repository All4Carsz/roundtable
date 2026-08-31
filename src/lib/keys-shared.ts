import type { BuiltinProviderId, CustomAiProvider } from "./types";

export type ApiKeys = Partial<Record<BuiltinProviderId, string>>;

export const BUILTIN_PROVIDERS: BuiltinProviderId[] = [
  "openai",
  "anthropic",
  "google",
  "xai",
];

export const HEADER_MAP: Record<BuiltinProviderId, string> = {
  openai: "x-rt-openai-key",
  anthropic: "x-rt-anthropic-key",
  google: "x-rt-google-key",
  xai: "x-rt-xai-key",
};

export const ENV_MAP: Record<BuiltinProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
};

export const CUSTOM_PROVIDERS_HEADER = "x-rt-custom-providers";

export type { CustomAiProvider };
