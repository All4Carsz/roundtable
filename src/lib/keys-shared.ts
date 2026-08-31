import type { ProviderId } from "./types";

export type ApiKeys = Partial<Record<ProviderId, string>>;

export const HEADER_MAP: Record<ProviderId, string> = {
  openai: "x-rt-openai-key",
  anthropic: "x-rt-anthropic-key",
  google: "x-rt-google-key",
  xai: "x-rt-xai-key",
};

export const ENV_MAP: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
};
