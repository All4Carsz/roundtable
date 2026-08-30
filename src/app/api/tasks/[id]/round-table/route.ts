import { NextResponse } from "next/server";
import { getTask } from "@/lib/store";
import { runRoundTable } from "@/lib/round-table";
import { budgetSnapshot } from "@/lib/control-plane";
import { configuredProviders } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    if (configuredProviders().length === 0) {
      return NextResponse.json(
        {
          error:
            "אין API keys. העתק .env.example ל-.env ומלא לפחות מפתח אחד.",
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Round Table נכשל" },
      { status: 500 },
    );
  }
}
