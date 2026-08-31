import { NextResponse } from "next/server";
import { BRAIN_LIST } from "@/lib/brains";
import {
  configuredProviders,
  getProviderStatuses,
  resolveBrainModel,
} from "@/lib/providers";
import { withRequestApiKeys } from "@/lib/with-api-keys";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withRequestApiKeys(req, async () => {
    const providers = getProviderStatuses();
    const assignments = Object.fromEntries(
      BRAIN_LIST.map((b) => {
        const resolved = resolveBrainModel(b.role, b.fallbackOrder);
        return [b.role, resolved];
      }),
    );

    return NextResponse.json({
      providers,
      assignments,
      ready: configuredProviders().length > 0,
    });
  });
}

/** Optional POST: send keys in JSON body to check readiness without custom headers. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return withRequestApiKeys(
    req,
    async () => {
      const providers = getProviderStatuses();
      return NextResponse.json({
        providers,
        ready: configuredProviders().length > 0,
        configuredCount: configuredProviders().length,
      });
    },
    body,
  );
}
