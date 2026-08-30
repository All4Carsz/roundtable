import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import type {
  AuditEvent,
  ControlPlaneState,
  CreateTaskInput,
  TaskRecord,
} from "./types";

/** On Vercel the app FS is read-only except /tmp (ephemeral per instance). */
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "roundtable-tasks")
  : path.join(process.cwd(), ".data", "tasks");

function defaultControlPlane(): ControlPlaneState {
  return {
    maxTokens: Number(process.env.ROUNDTABLE_MAX_TOKENS_PER_TASK || 200_000),
    maxCostUsd: Number(process.env.ROUNDTABLE_MAX_COST_USD || 5),
    maxRounds: Number(process.env.ROUNDTABLE_MAX_ROUNDS || 3),
    maxAttempts: Number(process.env.ROUNDTABLE_MAX_ATTEMPTS || 4),
    usedTokens: 0,
    usedCostUsd: 0,
    rounds: 0,
    attempts: 0,
    loopStrikes: 0,
    stopped: false,
  };
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function taskPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function listTasks(): Promise<TaskRecord[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const tasks: TaskRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    tasks.push(JSON.parse(raw) as TaskRecord);
  }
  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTask(id: string): Promise<TaskRecord | null> {
  try {
    const raw = await fs.readFile(taskPath(id), "utf8");
    return JSON.parse(raw) as TaskRecord;
  } catch {
    return null;
  }
}

export async function saveTask(task: TaskRecord): Promise<TaskRecord> {
  await ensureDir();
  task.updatedAt = new Date().toISOString();
  await fs.writeFile(taskPath(task.id), JSON.stringify(task, null, 2), "utf8");
  return task;
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const now = new Date().toISOString();
  const task: TaskRecord = {
    id: nanoid(12),
    title: input.title.trim(),
    goal: input.goal.trim(),
    workspacePath: input.workspacePath?.trim() || undefined,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    controlPlane: defaultControlPlane(),
    brainAssignments: {},
    roundTables: [],
    proposals: [],
    evidence: [],
    audit: [
      {
        id: nanoid(8),
        at: now,
        type: "task.created",
        message: "משימה נוצרה",
        meta: { title: input.title },
      },
    ],
  };
  return saveTask(task);
}

export function pushAudit(
  task: TaskRecord,
  type: string,
  message: string,
  meta?: Record<string, unknown>,
): AuditEvent {
  const event: AuditEvent = {
    id: nanoid(8),
    at: new Date().toISOString(),
    type,
    message,
    meta,
  };
  task.audit.unshift(event);
  return event;
}
