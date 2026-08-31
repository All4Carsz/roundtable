"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Swords,
  Users,
  CheckCircle2,
  FileCode2,
} from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { BRAINS } from "@/lib/brains";
import { apiFetch, loadClientApiKeys } from "@/lib/client-keys";
import { EvidenceBadge, TaskStatusBadge } from "./status-badge";
import { formatTokens, formatUsd } from "@/lib/utils";

type Budget = {
  tokensUsed: number;
  tokensMax: number;
  tokensPct: number;
  costUsed: number;
  costMax: number;
  costPct: number;
  rounds: number;
  maxRounds: number;
  attempts: number;
  maxAttempts: number;
  loopStrikes: number;
  stopped: boolean;
  stopReason?: string;
};

export function TaskClient({ id }: { id: string }) {
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/tasks/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "טעינה נכשלה");
    setTask(data.task);
    setBudget(data.budget);
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  async function run(action: "round-table" | "execute", body?: object) {
    setBusy(action);
    setError(null);
    try {
      const res = await apiFetch(`/api/tasks/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ ...(body || {}), ...loadClientApiKeys() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "הפעולה נכשלה");
      setTask(data.task);
      setBudget(data.budget);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await load().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  if (!task) {
    return (
      <div className="flex items-center gap-2 text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> טוען משימה...
      </div>
    );
  }

  const latestRound = task.roundTables[0];
  const latestProposal = task.proposals[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← חזרה
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {task.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <span className="font-mono text-xs text-zinc-500">{task.id}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            disabled={!!busy || task.controlPlane.stopped}
            onClick={() => run("round-table")}
          >
            {busy === "round-table" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            הפעל Round Table
          </button>
          <button
            className="btn btn-secondary"
            disabled={
              !!busy ||
              task.controlPlane.stopped ||
              task.roundTables.length === 0
            }
            onClick={() => run("execute")}
          >
            {busy === "execute" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileCode2 className="h-4 w-4" />
            )}
            בצע (Propose → Verify)
          </button>
          <button
            className="btn btn-danger"
            disabled={!!busy || task.controlPlane.stopped}
            onClick={() => run("execute", { switchModel: true })}
            title="החלף מוח Coder ונסה שוב"
          >
            <RefreshCw className="h-4 w-4" />
            החלף מוח
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {task.finalSummary && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
          {task.finalSummary}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-zinc-500">תקציב Tokens</div>
          <div className="mt-1 text-lg font-semibold">
            {formatTokens(budget?.tokensUsed || 0)} / {formatTokens(budget?.tokensMax || 0)}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${budget?.tokensPct || 0}%` }}
            />
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500">עלות משוערת</div>
          <div className="mt-1 text-lg font-semibold">
            {formatUsd(budget?.costUsed || 0)} / {formatUsd(budget?.costMax || 0)}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${budget?.costPct || 0}%` }}
            />
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500">סבבים / ניסיונות / Loops</div>
          <div className="mt-1 text-lg font-semibold">
            {budget?.rounds}/{budget?.maxRounds} · {budget?.attempts}/
            {budget?.maxAttempts} · {budget?.loopStrikes}
          </div>
          {budget?.stopped && (
            <div className="mt-2 text-xs text-red-300">{budget.stopReason}</div>
          )}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">המטרה</h2>
        <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">{task.goal}</p>
        {task.workspacePath && (
          <p className="mt-3 font-mono text-xs text-zinc-500">{task.workspacePath}</p>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-4 w-4 text-indigo-300" />
          <h2 className="text-lg font-semibold">השולחן העגול</h2>
        </div>
        {!latestRound && (
          <p className="text-sm text-zinc-500">
            עדיין לא רץ. לחץ &quot;הפעל Round Table&quot; כדי לשמוע 4 מוחות ואז סינתזה.
          </p>
        )}
        {latestRound && (
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <div className="text-xs text-zinc-500">החלטת Control Plane · סבב {latestRound.round}</div>
              <p className="mt-2 text-sm leading-7">{latestRound.decision}</p>
              {latestRound.needsHuman && (
                <div className="mt-3 flex items-start gap-2 text-sm text-amber-200">
                  <ShieldAlert className="mt-0.5 h-4 w-4" />
                  {latestRound.humanReason || "נדרש אדם"}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {latestRound.opinions.map((op) => {
                const isCustom = op.role === "custom";
                const brain =
                  op.role === "custom" ? null : BRAINS[op.role];
                const title = isCustom
                  ? op.guestName || "AI מותאם"
                  : brain?.hebrewLabel || op.role;
                const color = isCustom ? "#D946EF" : brain?.color || "#A1A1AA";
                return (
                  <div
                    key={`${op.role}-${op.provider}-${op.at}`}
                    className="rounded-xl border border-zinc-800 p-4"
                    style={{ borderTopColor: color, borderTopWidth: 2 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {title}
                          {isCustom && (
                            <span className="mr-2 text-[11px] font-normal text-fuchsia-300">
                              אורח
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-500">
                          {op.provider}/{op.model}
                        </div>
                      </div>
                      <span className="badge">{Math.round(op.confidence * 100)}%</span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-300">{op.summary}</p>
                    <p className="mt-2 text-sm text-zinc-400">
                      <span className="text-zinc-500">המלצה: </span>
                      {op.recommendation}
                    </p>
                    {op.risks.length > 0 && (
                      <ul className="mt-2 list-disc pr-4 text-xs text-red-200/90">
                        {op.risks.slice(0, 4).map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-emerald-300">הסכמות</h3>
                <ul className="space-y-1 text-sm text-zinc-400">
                  {latestRound.agreements.map((a) => (
                    <li key={a} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-amber-300">מחלוקות</h3>
                <ul className="space-y-1 text-sm text-zinc-400">
                  {latestRound.disagreements.length === 0 && <li>אין מחלוקת מפורשת</li>}
                  {latestRound.disagreements.map((d) => (
                    <li key={d}>• {d}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">תוכנית</h3>
              <div className="space-y-2">
                {latestRound.plan.map((step, idx) => (
                  <div
                    key={step.id}
                    className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {step.title}{" "}
                        <span className="text-xs font-normal text-zinc-500">
                          ({BRAINS[step.owner].hebrewLabel})
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">{step.details}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Acceptance: {step.acceptance}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {latestProposal && (
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-emerald-300" />
            <h2 className="text-lg font-semibold">הצעת קוד אחרונה</h2>
          </div>
          <div className="text-sm font-medium">{latestProposal.title}</div>
          <p className="mt-2 text-sm text-zinc-400">{latestProposal.rationale}</p>
          <div className="mt-2 font-mono text-[11px] text-zinc-500">
            {latestProposal.provider}/{latestProposal.model}
          </div>
          <div className="mt-4 space-y-3">
            {latestProposal.files.map((f) => (
              <details
                key={f.path + f.action}
                className="overflow-hidden rounded-xl border border-zinc-800"
              >
                <summary className="cursor-pointer bg-zinc-950/70 px-3 py-2 text-sm">
                  <span className="badge ml-2">{f.action}</span>
                  <span className="font-mono text-xs">{f.path}</span>
                </summary>
                <pre className="max-h-80 overflow-auto border-t border-zinc-800 bg-black/40 p-3 text-left text-[11px] leading-5 text-zinc-300" dir="ltr">
                  {f.content}
                </pre>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Evidence</h2>
          <div className="space-y-2">
            {task.evidence.length === 0 && (
              <p className="text-sm text-zinc-500">עדיין אין ראיות.</p>
            )}
            {task.evidence.slice(0, 20).map((e) => (
              <div key={e.id} className="rounded-lg border border-zinc-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{e.title}</div>
                  <EvidenceBadge status={e.status} />
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
                  {e.kind}
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-400">{e.detail}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Audit Trail</h2>
          <div className="space-y-2">
            {task.audit.slice(0, 30).map((a) => (
              <div
                key={a.id}
                className="flex gap-3 rounded-lg border border-zinc-800/80 px-3 py-2 text-sm"
              >
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                <div>
                  <div className="text-zinc-200">{a.message}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {a.type} · {new Date(a.at).toLocaleString("he-IL")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
