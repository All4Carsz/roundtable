import { generateObject } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";
import { BRAINS, BRAIN_LIST } from "./brains";
import {
  addUsage,
  assertCanRun,
  detectLoop,
  emptyUsage,
  markNeedsHuman,
  recordUsage,
} from "./control-plane";
import {
  appendEvidence,
  evaluateRoundTableConsistency,
} from "./evidence";
import { getRequestCustomProviders } from "./api-keys";
import {
  estimateCostUsd,
  getLanguageModel,
  resolveBrainModel,
} from "./providers";
import { pushAudit, saveTask } from "./store";
import type {
  BrainOpinion,
  BrainRole,
  CustomAiProvider,
  PlanStep,
  RoundTableResult,
  TaskRecord,
  UsageStats,
} from "./types";

const opinionSchema = z.object({
  summary: z.string(),
  recommendation: z.string(),
  risks: z.array(z.string()),
  openQuestions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const synthesisSchema = z.object({
  agreements: z.array(z.string()),
  disagreements: z.array(z.string()),
  decision: z.string(),
  needsHuman: z.boolean(),
  humanReason: z.string().optional(),
  plan: z.array(
    z.object({
      title: z.string(),
      owner: z.enum(["architect", "coder", "redteam", "researcher"]),
      details: z.string(),
      acceptance: z.string(),
    }),
  ),
});

function usageFromResult(
  provider: Parameters<typeof estimateCostUsd>[0],
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number },
): UsageStats {
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  const totalTokens = usage.totalTokens || inputTokens + outputTokens;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd(provider, inputTokens, outputTokens),
  };
}

async function askBrain(
  task: TaskRecord,
  role: BrainRole,
  priorContext: string,
): Promise<BrainOpinion> {
  const brain = BRAINS[role];
  const resolved = resolveBrainModel(role, brain.fallbackOrder);
  if (!resolved) {
    throw new Error("לא הוגדר אף API key. הוסף מפתחות או AI מותאם במסך ההגדרות.");
  }

  task.brainAssignments[role] = resolved;
  const model = getLanguageModel(resolved.provider, resolved.model);

  const result = await generateObject({
    model,
    schema: opinionSchema,
    system: brain.systemPrompt,
    prompt: `Task title: ${task.title}
User goal:
${task.goal}

${priorContext}

Return your independent opinion for the Round Table.
Be specific. Disagreement is welcome.`,
  });

  const usage = usageFromResult(resolved.provider, result.usage || {});
  recordUsage(task, usage);

  return {
    role,
    provider: resolved.provider,
    model: resolved.model,
    summary: result.object.summary,
    recommendation: result.object.recommendation,
    risks: result.object.risks,
    openQuestions: result.object.openQuestions,
    confidence: result.object.confidence,
    usage,
    at: new Date().toISOString(),
  };
}

async function askCustomGuest(
  task: TaskRecord,
  custom: CustomAiProvider,
  priorContext: string,
): Promise<BrainOpinion> {
  const model = getLanguageModel(custom.id, custom.model);
  const system =
    custom.systemPrompt?.trim() ||
    `You are "${custom.name}", an independent custom AI participant in "The Round Table".
Give a distinct perspective. Be concrete. Disagreement is welcome.
Respond in Hebrew for prose fields when the user goal is in Hebrew; keep technical terms in English.`;

  const result = await generateObject({
    model,
    schema: opinionSchema,
    system,
    prompt: `Task title: ${task.title}
User goal:
${task.goal}

${priorContext}

You are an extra custom brain at the Round Table named "${custom.name}".
Return your independent opinion.`,
  });

  const usage = usageFromResult(custom.id, result.usage || {});
  recordUsage(task, usage);

  return {
    role: "custom",
    guestName: custom.name,
    provider: custom.id,
    model: custom.model,
    summary: result.object.summary,
    recommendation: result.object.recommendation,
    risks: result.object.risks,
    openQuestions: result.object.openQuestions,
    confidence: result.object.confidence,
    usage,
    at: new Date().toISOString(),
  };
}

async function synthesize(
  task: TaskRecord,
  opinions: BrainOpinion[],
): Promise<Omit<RoundTableResult, "round" | "opinions" | "usage" | "at">> {
  const synthesizer =
    resolveBrainModel("architect", BRAINS.architect.fallbackOrder) ||
    resolveBrainModel("coder", BRAINS.coder.fallbackOrder);

  if (!synthesizer) {
    throw new Error("אין מודל זמין לסינתזה");
  }

  const model = getLanguageModel(synthesizer.provider, synthesizer.model);
  const result = await generateObject({
    model,
    schema: synthesisSchema,
    system: `You are the deterministic-leaning Chair of the Round Table Control Plane.
You do NOT invent false consensus.
Separate agreements from disagreements.
Prefer Evidence and experiments over voting.
If disagreement is material, set needsHuman=true or propose an experiment step in the plan.
Plan should be minimal and executable.
Write decision/plan in Hebrew if the goal is in Hebrew; keep tech terms in English.`,
    prompt: `Goal:
${task.goal}

Opinions:
${JSON.stringify(
  opinions.map((o) => ({
    role: o.role,
    provider: o.provider,
    model: o.model,
    summary: o.summary,
    recommendation: o.recommendation,
    risks: o.risks,
    openQuestions: o.openQuestions,
    confidence: o.confidence,
  })),
  null,
  2,
)}

Produce synthesis for the Control Plane.`,
  });

  const usage = usageFromResult(synthesizer.provider, result.usage || {});
  recordUsage(task, usage);

  const plan: PlanStep[] = result.object.plan.map((p) => ({
    id: nanoid(6),
    title: p.title,
    owner: p.owner,
    details: p.details,
    acceptance: p.acceptance,
  }));

  return {
    agreements: result.object.agreements,
    disagreements: result.object.disagreements,
    decision: result.object.decision,
    needsHuman: result.object.needsHuman,
    humanReason: result.object.humanReason,
    plan,
  };
}

export async function runRoundTable(task: TaskRecord): Promise<TaskRecord> {
  assertCanRun(task);
  task.status = "round_table";
  pushAudit(task, "round_table.start", "מתחיל סבב Round Table");

  const prior =
    task.roundTables.length > 0
      ? `Previous round decision:\n${task.roundTables[0].decision}\nPrevious disagreements:\n${task.roundTables[0].disagreements.join("\n")}`
      : "This is the first Round Table for this task.";

  const guests = getRequestCustomProviders().filter((p) => p.joinRoundTable);
  const settled = await Promise.allSettled([
    ...BRAIN_LIST.map((b) => askBrain(task, b.role, prior)),
    ...guests.map((g) => askCustomGuest(task, g, prior)),
  ]);

  const opinions: BrainOpinion[] = [];
  for (const item of settled) {
    if (item.status === "fulfilled") {
      opinions.push(item.value);
      const label =
        item.value.role === "custom"
          ? item.value.guestName || "AI מותאם"
          : BRAINS[item.value.role].hebrewLabel;
      pushAudit(
        task,
        "brain.opinion",
        `${label} דיבר (${item.value.provider}/${item.value.model})`,
        { role: item.value.role, confidence: item.value.confidence },
      );
    } else {
      pushAudit(task, "brain.error", `מוח נכשל: ${String(item.reason)}`);
    }
  }

  if (opinions.length === 0) {
    task.status = "failed";
    pushAudit(task, "round_table.failed", "אף מוח לא החזיר חוות דעת");
    return saveTask(task);
  }

  let synthesisUsage = emptyUsage();
  const beforeTokens = task.controlPlane.usedTokens;
  const beforeCost = task.controlPlane.usedCostUsd;

  const synth = await synthesize(task, opinions);

  synthesisUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: task.controlPlane.usedTokens - beforeTokens,
    estimatedCostUsd: task.controlPlane.usedCostUsd - beforeCost,
  };

  const allUsage = opinions.reduce(
    (acc, o) => addUsage(acc, o.usage),
    synthesisUsage,
  );

  task.controlPlane.rounds += 1;

  const result: RoundTableResult = {
    round: task.controlPlane.rounds,
    opinions,
    agreements: synth.agreements,
    disagreements: synth.disagreements,
    decision: synth.decision,
    plan: synth.plan,
    needsHuman: synth.needsHuman,
    humanReason: synth.humanReason,
    usage: allUsage,
    at: new Date().toISOString(),
  };

  task.roundTables.unshift(result);

  const fingerprint = `${synth.decision}|${synth.disagreements.join("|")}`.slice(
    0,
    240,
  );
  const looped = detectLoop(task, fingerprint);

  const evidence = evaluateRoundTableConsistency(result);
  appendEvidence(task, evidence);

  if (synth.needsHuman || looped) {
    markNeedsHuman(
      task,
      synth.humanReason ||
        (looped
          ? "זוהתה לולאה / חוסר התקדמות — נדרש Judgment אנושי"
          : "השולחן העגול מבקש מעורבות אנושית"),
    );
  } else {
    task.status = "planned";
    pushAudit(task, "round_table.done", "Round Table הסתיים עם תוכנית");
  }

  return saveTask(task);
}
