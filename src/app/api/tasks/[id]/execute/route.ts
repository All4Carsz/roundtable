import { NextResponse } from "next/server";
import { getTask, saveTask } from "@/lib/store";
import { runExecution, switchCoderBrain } from "@/lib/executor";
import { budgetSnapshot } from "@/lib/control-plane";
import { configuredProviders } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    if (configuredProviders().length === 0) {
      return NextResponse.json(
        { error: "אין API keys מוגדרים" },
        { status: 400 },
      );
    }

    const { id } = await ctx.params;
    let task = await getTask(id);
    if (!task) {
      return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      switchModel?: boolean;
    };

    if (body.switchModel) {
      task = await saveTask(switchCoderBrain(task));
    }

    const updated = await runExecution(task);
    return NextResponse.json({
      task: updated,
      budget: budgetSnapshot(updated.controlPlane),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ביצוע נכשל" },
      { status: 500 },
    );
  }
}
