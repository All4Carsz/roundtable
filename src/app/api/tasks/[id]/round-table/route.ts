import { NextResponse } from "next/server";
import { getTask } from "@/lib/store";
import { runRoundTable } from "@/lib/round-table";
import { budgetSnapshot } from "@/lib/control-plane";
import { configuredProviders } from "@/lib/providers";
import { withRequestApiKeys } from "@/lib/with-api-keys";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const body = await req.json().catch(() => ({}));
    return await withRequestApiKeys(
      req,
      async () => {
        if (configuredProviders().length === 0) {
          return NextResponse.json(
            {
              error:
                "אין API keys. הוסף מפתחות במסך ההגדרות (API Keys) באפליקציה.",
            },
            { status: 400 },
          );
        }

        const { id } = await ctx.params;
        const task = await getTask(id);
        if (!task) {
          return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
        }

        const updated = await runRoundTable(task);
        return NextResponse.json({
          task: updated,
          budget: budgetSnapshot(updated.controlPlane),
        });
      },
      body,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Round Table נכשל" },
      { status: 500 },
    );
  }
}
