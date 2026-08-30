import type { ControlPlaneState, TaskRecord, UsageStats } from "./types";
import { pushAudit } from "./store";

export function emptyUsage(): UsageStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  };
}

export function addUsage(a: UsageStats, b: UsageStats): UsageStats {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    estimatedCostUsd: a.estimatedCostUsd + b.estimatedCostUsd,
  };
}

export function assertCanRun(task: TaskRecord): void {
  const cp = task.controlPlane;
  if (cp.stopped) {
    throw new Error(cp.stopReason || "Control Plane עצר את המשימה");
  }
  if (cp.usedTokens >= cp.maxTokens) {
    stopTask(task, "חריגה מתקציב Tokens");
    throw new Error("חריגה מתקציב Tokens");
  }
  if (cp.usedCostUsd >= cp.maxCostUsd) {
    stopTask(task, "חריגה מתקציב עלות");
    throw new Error("חריגה מתקציב עלות");
  }
  if (cp.rounds >= cp.maxRounds && task.status === "round_table") {
    stopTask(task, "חריגה ממספר סבבי Round Table");
    throw new Error("חריגה ממספר סבבי Round Table");
  }
  if (cp.attempts >= cp.maxAttempts) {
    stopTask(task, "חריגה ממספר ניסיונות ביצוע");
    throw new Error("חריגה ממספר ניסיונות ביצוע");
  }
}

export function recordUsage(task: TaskRecord, usage: UsageStats): void {
  task.controlPlane.usedTokens += usage.totalTokens;
  task.controlPlane.usedCostUsd += usage.estimatedCostUsd;
  if (
    task.controlPlane.usedTokens >= task.controlPlane.maxTokens ||
    task.controlPlane.usedCostUsd >= task.controlPlane.maxCostUsd
  ) {
    stopTask(task, "תקציב Control Plane הסתיים");
  }
}

export function stopTask(task: TaskRecord, reason: string): void {
  task.controlPlane.stopped = true;
  task.controlPlane.stopReason = reason;
  task.status = "stopped";
  pushAudit(task, "control_plane.stop", reason);
}

export function markNeedsHuman(task: TaskRecord, reason: string): void {
  task.status = "needs_human";
  pushAudit(task, "human.escalation", reason);
}

/** Simple loop heuristic: repeated similar summaries / failed evidence. */
export function detectLoop(task: TaskRecord, latestFingerprint: string): boolean {
  const previous = task.audit
    .filter((e) => e.type === "loop.fingerprint")
    .slice(0, 3)
    .map((e) => String(e.meta?.fingerprint || ""));

  const hits = previous.filter((p) => p && p === latestFingerprint).length;
  pushAudit(task, "loop.fingerprint", "נרשם fingerprint להתקדמות", {
    fingerprint: latestFingerprint,
    hits,
  });

  if (hits >= 2) {
    task.controlPlane.loopStrikes += 1;
    pushAudit(task, "loop.detected", "זוהתה אפשרות ללולאה / חוסר התקדמות", {
      strikes: task.controlPlane.loopStrikes,
    });
    return true;
  }
  return false;
}

export function budgetSnapshot(cp: ControlPlaneState) {
  return {
    tokensUsed: cp.usedTokens,
    tokensMax: cp.maxTokens,
    tokensPct: Math.min(100, Math.round((cp.usedTokens / Math.max(1, cp.maxTokens)) * 100)),
    costUsed: cp.usedCostUsd,
    costMax: cp.maxCostUsd,
    costPct: Math.min(100, Math.round((cp.usedCostUsd / Math.max(0.0001, cp.maxCostUsd)) * 100)),
    rounds: cp.rounds,
    maxRounds: cp.maxRounds,
    attempts: cp.attempts,
    maxAttempts: cp.maxAttempts,
    loopStrikes: cp.loopStrikes,
    stopped: cp.stopped,
    stopReason: cp.stopReason,
  };
}
