"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import type { BrainRole, CustomAiProvider } from "@/lib/types";
import {
  CUSTOM_PRESETS,
  loadCustomProviders,
  newCustomProviderId,
  saveCustomProviders,
} from "@/lib/client-keys";

const ROLE_OPTIONS: Array<{ value: BrainRole | ""; label: string }> = [
  { value: "", label: "ללא שיוך (רק זמין כ-fallback)" },
  { value: "architect", label: "Architect — ארכיטקט" },
  { value: "coder", label: "Coder — מפתח" },
  { value: "redteam", label: "Red Team — מוח אדום" },
  { value: "researcher", label: "Researcher — חוקר" },
];

const emptyDraft = (): Omit<CustomAiProvider, "id"> & { id?: string } => ({
  name: "",
  baseUrl: "https://api.example.com/v1",
  apiKey: "",
  model: "",
  assignToRole: null,
  joinRoundTable: true,
  systemPrompt: "",
  enabled: true,
});

export function CustomAiForm() {
  const [items, setItems] = useState<CustomAiProvider[]>([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadCustomProviders());
  }, []);

  function persist(next: CustomAiProvider[]) {
    setItems(next);
    saveCustomProviders(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function applyPreset(presetId: string) {
    const preset = CUSTOM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft((d) => ({
      ...d,
      name: d.name || preset.label,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
    setMsg(`נבחרה תבנית ${preset.label} — השלם API key ושמור`);
  }

  function startEdit(item: CustomAiProvider) {
    setEditingId(item.id);
    setDraft({ ...item });
    setMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
    setMsg(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    const baseUrl = draft.baseUrl.trim().replace(/\/+$/, "");
    const apiKey = draft.apiKey.trim();
    const model = draft.model.trim();
    if (!name || !baseUrl || !apiKey || !model) {
      setMsg("חובה למלא: שם, Base URL, API Key, ומודל");
      return;
    }

    try {
      // eslint-disable-next-line no-new
      new URL(baseUrl);
    } catch {
      setMsg("Base URL לא תקין");
      return;
    }

    const record: CustomAiProvider = {
      id: editingId || newCustomProviderId(),
      name,
      baseUrl,
      apiKey,
      model,
      assignToRole: draft.assignToRole || null,
      joinRoundTable: Boolean(draft.joinRoundTable),
      systemPrompt: draft.systemPrompt?.trim() || undefined,
      enabled: draft.enabled !== false,
    };

    const next = editingId
      ? items.map((i) => (i.id === editingId ? record : i))
      : [...items, record];

    persist(next);
    cancelEdit();
    setMsg(editingId ? "ה-AI עודכן" : "ה-AI נוסף למערכת");
  }

  function remove(id: string) {
    persist(items.filter((i) => i.id !== id));
    if (editingId === id) cancelEdit();
  }

  function toggleEnabled(id: string) {
    persist(
      items.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)),
    );
  }

  async function testOne(item: CustomAiProvider) {
    setTestingId(item.id);
    setMsg(null);
    try {
      const res = await fetch("/api/providers/test-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "בדיקה נכשלה");
      setMsg(`✓ ${item.name}: החיבור עובד (${data.model || item.model})`);
    } catch (err) {
      setMsg(
        `✗ ${item.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          הוסף כל AI עם API תואם OpenAI (OpenRouter, DeepSeek, Groq, Ollama,
          Mistral, Together ועוד). אפשר לשייך אותו לתפקיד קיים ו/או להושיב אותו
          כאורח נוסף בשולחן העגול.
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          תבניות מהירות
        </div>
        <div className="flex flex-wrap gap-2">
          {CUSTOM_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn btn-secondary !py-1.5 !text-xs"
              onClick={() => applyPreset(p.id)}
              title={p.help}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">
            {editingId ? "עריכת AI מותאם" : "הוספת AI חדש"}
          </h3>
          {editingId && (
            <button type="button" className="text-xs text-zinc-400 hover:text-zinc-200" onClick={cancelEdit}>
              ביטול עריכה
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1.5 text-sm md:col-span-2">
            <span className="text-zinc-400">שם לתצוגה</span>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="למשל: DeepSeek Critic"
              required
            />
          </label>

          <label className="block space-y-1.5 text-sm md:col-span-2">
            <span className="text-zinc-400">Base URL</span>
            <input
              className="input font-mono text-xs"
              dir="ltr"
              value={draft.baseUrl}
              onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
              placeholder="https://api.deepseek.com"
              required
            />
          </label>

          <label className="block space-y-1.5 text-sm md:col-span-2">
            <span className="text-zinc-400">API Key</span>
            <div className="relative">
              <input
                className="input pl-11 font-mono text-xs"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                value={draft.apiKey}
                onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                placeholder="sk-..."
                required
              />
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800"
                onClick={() => setShowKey((s) => !s)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-400">Model ID</span>
            <input
              className="input font-mono text-xs"
              dir="ltr"
              value={draft.model}
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              placeholder="deepseek-chat"
              required
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-400">שיוך לתפקיד</span>
            <select
              className="input"
              value={draft.assignToRole || ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  assignToRole: (e.target.value || null) as BrainRole | null,
                }))
              }
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(draft.joinRoundTable)}
              onChange={(e) =>
                setDraft((d) => ({ ...d, joinRoundTable: e.target.checked }))
              }
            />
            <span>הושב כאורח נוסף בשולחן העגול (חוות דעת נוספת)</span>
          </label>

          <label className="block space-y-1.5 text-sm md:col-span-2">
            <span className="text-zinc-400">System Prompt (אופציונלי לאורח)</span>
            <textarea
              className="textarea min-h-24 text-sm"
              value={draft.systemPrompt || ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, systemPrompt: e.target.value }))
              }
              placeholder="תפקיד מיוחד למוח הזה, למשל: התמקד בעלויות וביצועים..."
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary">
          {editingId ? (
            <>
              <Check className="h-4 w-4" /> עדכן AI
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> הוסף למערכת
            </>
          )}
        </button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">AI מותאמים ({items.length})</h3>
          {saved && <span className="text-xs text-emerald-300">נשמר</span>}
        </div>

        {items.length === 0 && (
          <p className="text-sm text-zinc-500">
            עדיין אין AI מותאם. בחר תבנית או מלא את הטופס למעלה.
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className={`badge ${item.enabled ? "badge-pass" : "badge-skip"}`}>
                    {item.enabled ? "פעיל" : "כבוי"}
                  </span>
                  {item.joinRoundTable && (
                    <span className="badge">אורח בשולחן</span>
                  )}
                  {item.assignToRole && (
                    <span className="badge">תפקיד: {item.assignToRole}</span>
                  )}
                </div>
                <div className="mt-2 space-y-1 font-mono text-[11px] text-zinc-500" dir="ltr">
                  <div>{item.baseUrl}</div>
                  <div>{item.model}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary !py-1.5 !text-xs"
                  onClick={() => testOne(item)}
                  disabled={testingId === item.id}
                >
                  {testingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  בדיקה
                </button>
                <button
                  type="button"
                  className="btn btn-secondary !py-1.5 !text-xs"
                  onClick={() => startEdit(item)}
                >
                  עריכה
                </button>
                <button
                  type="button"
                  className="btn btn-secondary !py-1.5 !text-xs"
                  onClick={() => toggleEnabled(item.id)}
                >
                  {item.enabled ? "כבה" : "הפעל"}
                </button>
                <button
                  type="button"
                  className="btn btn-danger !py-1.5 !text-xs"
                  onClick={() => remove(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
          {msg}
        </div>
      )}
    </div>
  );
}
