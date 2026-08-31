import { ApiKeysForm } from "@/components/api-keys-form";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">API Keys</h1>
        <p className="mt-2 text-sm text-zinc-400">
          כאן מחברים את המוחות. בלי לפחות מפתח אחד — Round Table לא ירוץ.
        </p>
      </div>
      <div className="card p-6">
        <ApiKeysForm />
      </div>
    </div>
  );
}
