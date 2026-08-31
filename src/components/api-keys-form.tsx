"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, Trash2 } from "lucide-react";
import type { BuiltinProviderId } from "@/lib/types";
import type { ApiKeys } from "@/lib/keys-shared";
import {
  PROVIDER_META,
  clearClientApiKeys,
  clientKeysConfiguredCount,
  loadClientApiKeys,
  loadCustomProviders,
  saveClientApiKeys,
} from "@/lib/client-keys";

export function ApiKeysForm({ onSaved }: { onSaved?: (keys: ApiKeys) => void }) {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [show, setShow] = useState<Partial<Record<BuiltinProviderId, boolean>>>({});
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    setKeys(loadClientApiKeys());
  }, []);

  function update(id: BuiltinProviderId, value: string) {
    setKeys((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
    setTestMsg(null);
  }

  function onSave() {
    saveClientApiKeys(keys);
    setSaved(true);
    onSaved?.(loadClientApiKeys());
  }

  function onClear() {
    clearClientApiKeys();
    setKeys({});
    setSaved(false);
    setTestMsg(null);
    onSaved?.({});
  }

  async function onTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      saveClientApiKeys(keys);
      const current = loadClientApiKeys();
      const customs = loadCustomProviders();
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current, customProviders: customs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "בדיקה נכשלה");
      const count = data.configuredCount ?? 0;
      const customCount = data.customCount ?? 0;
      setTestMsg(
        count > 0
          ? `מוכן: ${count} ספקים (${customCount} מותאמים). אפשר להפעיל Round Table.`
          : "לא זוהה אף מפתח/AI. מלא מפתח מובנה או הוסף AI מותאם.",
      );
      onSaved?.(current);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  const count = clientKeysConfiguredCount(keys);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-100">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          המפתחות נשמרים <strong>רק בדפדפן שלך</strong> (localStorage) ונשלחים לשרת
          שלנו רק בזמן קריאה למודלים. הם לא נשמרים ב-GitHub ולא בדאטהבייס.
          מספיק מפתח אחד כדי להתחיל; כמה מפתחות = Multi-Brain אמיתי.
        </div>
      </div>

      <div className="grid gap-4">
        {PROVIDER_META.map((p) => (
          <label key={p.id} className="block space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zinc-200">{p.label}</span>
              <span className="text-[11px] text-zinc-500">{p.help}</span>
            </div>
            <div className="relative">
              <input
                className="input pl-11 font-mono text-xs"
                type={show[p.id] ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder={p.placeholder}
                value={keys[p.id] || ""}
                onChange={(e) => update(p.id, e.target.value)}
              />
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => setShow((s) => ({ ...s, [p.id]: !s[p.id] }))}
                aria-label={show[p.id] ? "הסתר" : "הצג"}
              >
                {show[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={onSave}>
          {saved ? <Check className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          שמור מפתחות
        </button>
        <button type="button" className="btn btn-secondary" onClick={onTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          בדיקת חיבור
        </button>
        <button type="button" className="btn btn-danger" onClick={onClear}>
          <Trash2 className="h-4 w-4" />
          מחק הכל
        </button>
      </div>

      <div className="text-xs text-zinc-500">{count} מפתחות מוגדרים בדפדפן</div>
      {testMsg && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
          {testMsg}
        </div>
      )}
    </div>
  );
}
