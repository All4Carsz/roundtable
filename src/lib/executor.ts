import { generateObject } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";
import { BRAINS } from "./brains";
import {
  assertCanRun,
  detectLoop,
  markNeedsHuman,
  recordUsage,
} from "./control-plane";
import {
  appendEvidence,
  evaluateProposalSchema,
  evaluateWorkspace,
  hasBlockingFailures,
} from "./evidence";
import {
  estimateCostUsd,
  getLanguageModel,
  resolveBrainModel,
} from "./providers";
import { pushAudit, saveTask } from "./store";
import type { CodeProposal, TaskRecord } from "./types";

const proposalSchema = z.object({
  title: z.string(),
  rationale: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      action: z.enum(["create", "modify", "delete"]),
      language: z.string().optional(),
      content: z.string(),
    }),
  ),
  testsToRun: z.array(z.string()),
  risks: z.array(z.string()),
});

const reviewSchema = z.object({
  approve: z.boolean(),
  findings: z.array(z.string()),
  blockers: z.array(z.string()),
  summary: z.string(),
});

export async function runExecution(task: TaskRecord): Promise<TaskRecord> {
  assertCanRun(task);

  const latest = task.roundTables[0];
  if (!latest) {
    throw new Error("אין Round Table — אי אפשר לבצע");
  }

  task.status = "executing";
  task.controlPlane.attempts += 1;
  pushAudit(task, "execute.start", `ניסיון ביצוע #${task.controlPlane.attempts}`);

  const coderResolved =
    resolveBrainModel("coder", BRAINS.coder.fallbackOrder) ||
    resolveBrainModel("architect", BRAINS.architect.fallbackOrder);

  if (!coderResolved) {
    throw new Error("אין מודל זמין לביצוע");
  }

  const coderModel = getLanguageModel(coderResolved.provider, coderResolved.model);

  const proposalResult = await generateObject({
    model: coderModel,
    schema: proposalSchema,
    system: `${BRAINS.coder.systemPrompt}

You propose structured file changes only. This is a POC: prefer a small vertical slice.
Do not claim tests passed. The Control Plane verifies separately.
If the plan is unclear, still propose the safest minimal scaffold and list risks.`,
    prompt: `Goal:
${task.goal}

Round Table decision:
${latest.decision}

Plan:
${JSON.stringify(latest.plan, null, 2)}

Agreements:
${latest.agreements.join("\n")}

Disagreements:
${latest.disagreements.join("\n")}

Previous proposal failures (if any):
${task.evidence
  .filter((e) => e.status === "fail")
  .slice(0, 5)
  .map((e) => `- ${e.title}: ${e.detail}`)
  .join("\n") || "None"}

Propose a structured implementation slice.`,
  });

  const usage = {
    inputTokens: proposalResult.usage?.inputTokens || 0,
    outputTokens: proposalResult.usage?.outputTokens || 0,
    totalTokens:
      proposalResult.usage?.totalTokens ||
      (proposalResult.usage?.inputTokens || 0) +
        (proposalResult.usage?.outputTokens || 0),
    estimatedCostUsd: estimateCostUsd(
      coderResolved.provider,
      proposalResult.usage?.inputTokens || 0,
      proposalResult.usage?.outputTokens || 0,
    ),
  };
  recordUsage(task, usage);

  const proposal: CodeProposal = {
    id: nanoid(8),
    title: proposalResult.object.title,
    rationale: proposalResult.object.rationale,
    files: proposalResult.object.files,
    testsToRun: proposalResult.object.testsToRun,
    risks: proposalResult.object.risks,
    provider: coderResolved.provider,
    model: coderResolved.model,
    usage,
    at: new Date().toISOString(),
  };
  task.proposals.unshift(proposal);
  pushAudit(task, "execute.proposal", `הצעת קוד: ${proposal.title}`, {
    files: proposal.files.length,
  });

  // Schema / static evidence first
  const schemaEvidence = evaluateProposalSchema(proposal);
  appendEvidence(task, schemaEvidence);

  // Red-team review of the proposal (different brain when possible)
  const redResolved =
    resolveBrainModel("redteam", BRAINS.redteam.fallbackOrder) ||
    resolveBrainModel("researcher", BRAINS.researcher.fallbackOrder);

  if (redResolved) {
    const redModel = getLanguageModel(redResolved.provider, redResolved.model);
    const review = await generateObject({
      model: redModel,
      schema: reviewSchema,
      system: BRAINS.redteam.systemPrompt,
      prompt: `Review this code proposal adversarially.

Goal: ${task.goal}
Decision: ${latest.decision}
Proposal JSON:
${JSON.stringify(proposalResult.object, null, 2)}`,
    });

    const redUsage = {
      inputTokens: review.usage?.inputTokens || 0,
      outputTokens: review.usage?.outputTokens || 0,
      totalTokens:
        review.usage?.totalTokens ||
        (review.usage?.inputTokens || 0) + (review.usage?.outputTokens || 0),
      estimatedCostUsd: estimateCostUsd(
        redResolved.provider,
        review.usage?.inputTokens || 0,
        review.usage?.outputTokens || 0,
      ),
    };
    recordUsage(task, redUsage);

    appendEvidence(task, [
      {
        id: nanoid(8),
        kind: "manual",
        status: review.object.approve && review.object.blockers.length === 0 ? "pass" : "fail",
        title: "Red Team review",
        detail: `${review.object.summary}\nFindings: ${review.object.findings.join("; ")}\nBlockers: ${review.object.blockers.join("; ") || "none"}`,
        at: new Date().toISOString(),
      },
    ]);

    pushAudit(
      task,
      "execute.redteam",
      review.object.approve ? "Red Team לא חסם" : "Red Team חסם הצעה",
      { blockers: review.object.blockers },
    );
  }

  // Optional workspace checks
  const workspaceEvidence = await evaluateWorkspace(task);
  appendEvidence(task, workspaceEvidence);

  const recent = task.evidence.slice(0, 12);
  const blocked = hasBlockingFailures(recent);

  const fingerprint = `${proposal.title}|${proposal.files.map((f) => f.path).join(",")}`.slice(
    0,
    240,
  );
  const looped = detectLoop(task, fingerprint);

  if (blocked || looped) {
    if (task.controlPlane.attempts >= task.controlPlane.maxAttempts || looped) {
      markNeedsHuman(
        task,
        looped
          ? "לולאה בביצוע — נדרש אדם"
          : "Evidence נכשל אחרי ניסיונות — נדרש אדם",
      );
      task.finalSummary = "הביצוע נעצר. בדוק Evidence ו-Audit.";
    } else {
      // Stay executable for retry / model switch opportunity
      task.status = "planned";
      pushAudit(
        task,
        "execute.retry_ready",
        "ההצעה נכשלה ב-Evidence — ניתן לנסות שוב (או להחליף מוח)",
      );
      task.finalSummary = "יש כשל Evidence. אפשר להריץ שוב או לחזור ל-Round Table.";
    }
  } else {
    task.status = "completed";
    task.finalSummary =
      "POC: ההצעה עברה שערי Evidence בסיסיים. קבצים לא נכתבו אוטומטית לדיסק (Propose → Verify). אפשר להעתיק מההצעה ידנית.";
    pushAudit(task, "execute.completed", "המשימה הושלמה ברמת POC");
  }

  return saveTask(task);
}

/** Switch coder assignment to another available provider and retry-ready. */
export function switchCoderBrain(task: TaskRecord): TaskRecord {
  const current = task.brainAssignments.coder?.provider;
  const order = BRAINS.coder.fallbackOrder;
  const next =
    resolveBrainModel(
      "coder",
      current ? order.filter((p) => p !== current) : order,
    ) || null;

  if (!next) {
    pushAudit(task, "model_switch.failed", "אין מודל חלופי ל-Coder");
    return task;
  }

  task.brainAssignments.coder = next;
  task.status = "planned";
  pushAudit(
    task,
    "model_switch",
    `Coder הוחלף ל-${next.provider}/${next.model}`,
    { from: current, to: next },
  );
  return task;
}
