import { ApiKeysForm } from "@/components/api-keys-form";
import { CustomAiForm } from "@/components/custom-ai-form";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          חיבור מוחות
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          חבר ספקים מובנים, או הוסף AI מותאם אישית עם Base URL + API Key + Model.
        </p>
      </div>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">ספקים מובנים</h2>
          <p className="mt-1 text-sm text-zinc-500">
            OpenAI, Anthropic, Google, xAI — מספיק מפתח אחד כדי להתחיל.
          </p>
        </div>
        <ApiKeysForm />
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">AI מותאם אישית</h2>
          <p className="mt-1 text-sm text-zinc-500">
            OpenRouter, DeepSeek, Groq, Ollama, Mistral, Together — או כל endpoint
            תואם OpenAI.
          </p>
        </div>
        <CustomAiForm />
      </section>
    </div>
  );
}
