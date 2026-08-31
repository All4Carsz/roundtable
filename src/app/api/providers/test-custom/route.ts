import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { normalizeCustomProviders } from "@/lib/api-keys";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const [provider] = normalizeCustomProviders([
      {
        id: body.id || "custom_test",
        name: body.name || "Custom",
        baseUrl: body.baseUrl,
        apiKey: body.apiKey,
        model: body.model,
        joinRoundTable: false,
        enabled: true,
      },
    ]);

    if (!provider) {
      return NextResponse.json(
        { error: "חסרים שדות: baseUrl, apiKey, model" },
        { status: 400 },
      );
    }

    const openai = createOpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
      name: provider.name,
    });

    const result = await generateText({
      model: openai(provider.model),
      prompt: 'Reply with exactly: OK',
      maxOutputTokens: 16,
    });

    const text = (result.text || "").trim();
    return NextResponse.json({
      ok: true,
      model: provider.model,
      preview: text.slice(0, 80),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "בדיקת החיבור לספק המותאם נכשלה",
      },
      { status: 400 },
    );
  }
}
