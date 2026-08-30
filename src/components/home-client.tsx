"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Sparkles, KeyRound } from "lucide-react";
import type { ProviderStatus, TaskRecord } from "@/lib/types";
import { TaskStatusBadge } from "./status-badge";

type ProvidersResponse = {
  providers: ProviderStatus[];
  ready: boolean;
  assignments: Record<string, { provider: string; model: string } | null>;
};

export function HomeClient() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [workspacePath, setWorkspacePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [t, p] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/providers").then((r) => r.json()),
    ]);
    setTasks(t.tasks || []);
    setProviders(p);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          goal,
          workspacePath: workspacePath || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "יצירה נכשלה");
      setTitle("");
      setGoal("");
      setWorkspacePath("");
      await refresh();
      window.location.href = `/tasks/${data.task.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-indigo-300">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold tracking-wide">MULTI-BRAIN POC</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              ארגון של מוחות, לא צ׳אט אחד
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              POC שמממש את ליבת החזון: Round Table בין 4 מוחות, Control Plane עם תקציבים,
              Evidence over Consensus, והחלפת מוח אחרי כשל — בלי מחלקות מיותרות.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(providers?.providers || []).map((p) => (
            <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.label}</span>
                <span className={`badge ${p.configured ? "badge-pass" : "badge-fail"}`}>
                  {p.configured ? "מוכן" : "חסר key"}
                </span>
              </div>
              <div className="mt-2 font-mono text-[11px] text-zinc-500">{p.defaultModel}</div>
            </div>
          ))}
        </div>

        {!providers?.ready && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              אין API keys. העתק <code className="font-mono">.env.example</code> ל-
              <code className="font-mono">.env</code> ומלא לפחות מפתח אחד, ואז הפעל מחדש את
              השרת.
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={onCreate} className="card space-y-4 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">משימה חדשה</h2>
          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-400">כותרת</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: מערכת ניהול מחסן MVP"
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-400">מטרה / דרישה</span>
            <textarea
              className="textarea min-h-40"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="תאר מה לבנות, אילו אילוצים יש, ומה נחשב הצלחה..."
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-400">Workspace (אופציונלי)</span>
            <input
              className="input font-mono text-xs"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="/path/to/project — להרצת lint/test"
            />
          </label>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <button className="btn btn-primary w-full" disabled={loading || !providers?.ready}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            צור והתחל
          </button>
        </form>

        <div className="card p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">משימות</h2>
            <span className="text-xs text-zinc-500">{tasks.length} רשומות</span>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 && (
              <p className="text-sm text-zinc-500">עדיין אין משימות. צור את הראשונה.</p>
            )}
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 transition hover:border-indigo-500/40 hover:bg-zinc-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{task.title}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-zinc-500">{task.goal}</div>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-500">
                  <span className="font-mono">{task.id}</span>
                  <span>{new Date(task.updatedAt).toLocaleString("he-IL")}</span>
                  <span>
                    ${task.controlPlane.usedCostUsd.toFixed(4)} ·{" "}
                    {task.controlPlane.usedTokens} tokens
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
