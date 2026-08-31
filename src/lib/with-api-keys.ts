import {
  mergeApiKeys,
  mergeCustomProviders,
  parseApiKeysFromBody,
  parseApiKeysFromHeaders,
  parseCustomProvidersFromBody,
  parseCustomProvidersFromHeaders,
  runWithApiKeys,
  type ApiKeys,
} from "./api-keys";
import type { CustomAiProvider } from "./types";

export async function withRequestApiKeys<T>(
  req: Request,
  fn: (ctx: { keys: ApiKeys; customProviders: CustomAiProvider[] }) => Promise<T>,
  body?: unknown,
): Promise<T> {
  const keys = mergeApiKeys(
    parseApiKeysFromHeaders(req.headers),
    parseApiKeysFromBody(body),
  );
  const customProviders = mergeCustomProviders(
    parseCustomProvidersFromHeaders(req.headers),
    parseCustomProvidersFromBody(body),
  );
  return runWithApiKeys(keys, () => fn({ keys, customProviders }), customProviders);
}
