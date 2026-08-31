import { NextResponse } from "next/server";
import { getTask, saveTask } from "@/lib/store";
import { runExecution, switchCoderBrain } from "@/lib/executor";
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
    const body = (await req.json().catch(() => ({}))) as {
      switchModel?: boolean;
      openai?: string;
      anthropic?: string;
      google?: string;
      xai?: string;
    };

    return await withRequestApiKeys(
      req,
      async () => {
        if (configuredProviders().length === 0) {
          return NextResponse.json(
            { error: "אין API keys. הוסף מפתחות במסך ההגדרות." },
            { status: 400 },
          );
        }

        const { id } = await ctx.params;
        let task = await getTask(id);
        if (!task) {
          return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
        }

        if (body.switchModel) {
          task = await saveTask(switchCoderBrain(task));
        }

        const updated = await runExecution(task);
        return NextResponse.json({
          task: updated,
          budget: budgetSnapshot(updated.controlPlane),
        });
      },
      body,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ביצוע נכשל" },
      { status: 500 },
    );
  }
}
