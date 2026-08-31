import {
  mergeApiKeys,
  parseApiKeysFromBody,
  parseApiKeysFromHeaders,
  runWithApiKeys,
  type ApiKeys,
} from "./api-keys";

export async function withRequestApiKeys<T>(
  req: Request,
  fn: (keys: ApiKeys) => Promise<T>,
  body?: unknown,
): Promise<T> {
  const keys = mergeApiKeys(
    parseApiKeysFromHeaders(req.headers),
    parseApiKeysFromBody(body),
  );
  return runWithApiKeys(keys, () => fn(keys));
}
