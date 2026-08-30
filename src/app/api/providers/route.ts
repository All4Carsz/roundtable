import { NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/providers";
import { BRAIN_LIST } from "@/lib/brains";
import { resolveBrainModel } from "@/lib/providers";

export const runtime = "nodejs";

export async function GET() {
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
    ready: providers.some((p) => p.configured),
  });
}
