import { NextResponse } from "next/server";
import { z } from "zod";
import { createTask, listTasks } from "@/lib/store";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().min(2).max(200),
  goal: z.string().min(10).max(8000),
  workspacePath: z.string().max(500).optional(),
});

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const task = await createTask(parsed);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאה ביצירת משימה" },
      { status: 400 },
    );
  }
}
