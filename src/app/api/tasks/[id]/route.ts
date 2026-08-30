import { NextResponse } from "next/server";
import { getTask } from "@/lib/store";
import { budgetSnapshot } from "@/lib/control-plane";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const task = await getTask(id);
  if (!task) {
    return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
  }
  return NextResponse.json({
    task,
    budget: budgetSnapshot(task.controlPlane),
  });
}
