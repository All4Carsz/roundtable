# השולחן העגול — Round Table POC

POC מינימלי לפלטפורמת **Multi-Brain** לפיתוח תוכנה:

- 4 מוחות: Architect / Coder / Red Team / Researcher
- **Round Table** עם סינתזה (הסכמות, מחלוקות, תוכנית)
- **Control Plane** דטרמיניסטי: תקציב tokens/עלות, סבבים, ניסיונות, עצירה
- **Evidence over Consensus**: schema, security סטטי, red-team review, lint/test אופציונלי
- **Model switch** אחרי כשל
- Audit trail + UI ב-Next.js

> זה POC לבדיקת ההיפותזה — לא המערכת המלאה מהמסמך.

## Production (Vercel)

- URL: https://roundtable-poc.vercel.app
- Project: `mas-projects-c7518415/roundtable-poc`

הוסף API keys ב-Vercel (Production + Preview):

```bash
cd poc
vercel env add OPENAI_API_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
vercel env add XAI_API_KEY production
vercel --prod
```

או דרך הדשבורד:  
https://vercel.com/mas-projects-c7518415/roundtable-poc/settings/environment-variables

> ב-Vercel האחסון של משימות הוא ephemeral (`/tmp`) — מתאים ל-POC, לא לשימוש ארוך טווח.

## התקנה מקומית

```bash
cd poc
cp .env.example .env
# מלא לפחות API key אחד:
# OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / XAI_API_KEY

npm install
npm run dev
```

פתח: [http://localhost:3000](http://localhost:3000)

## זרימת עבודה

1. צור משימה (כותרת + מטרה; Workspace אופציונלי לנתיב פרויקט מקומי)
2. **הפעל Round Table** — 4 מוחות במקביל + Chair לסינתזה
3. **בצע (Propose → Verify)** — Coder מציע קבצים, Red Team בודק, Evidence נאסף
4. אם נכשל: **החלף מוח** ונסה שוב, או הרץ Round Table נוסף

הקבצים **לא נכתבים אוטומטית לדיסק** ב-POC הזה (Propose → Verify). אפשר להעתיק מההצעה ידנית.

## מיפוי מוחות (ברירת מחדל)

| תפקיד | Provider מועדף | Fallback |
|--------|----------------|----------|
| Architect | OpenAI | Anthropic → Google → xAI |
| Coder | Anthropic | OpenAI → Google → xAI |
| Red Team | xAI | Anthropic → OpenAI → Google |
| Researcher | Google | OpenAI → Anthropic → xAI |

אם חסר key — המערכת נופלת אוטומטית לספק זמין.

Override לדוגמה ב-`.env`:

```env
ROUNDTABLE_CODER_MODEL=anthropic:claude-sonnet-4-5
```

## מה בכוונה לא נבנה ב-POC

- 20 מחלקות / ארגון מלא
- Mutation testing
- Dependency graph מושלם
- UI ענק / SaaS multi-tenant
- כתיבה אוטומטית ל-git worktrees (אפשר בשלב הבא)

## מבנה

```
src/lib/          # brains, providers, control-plane, evidence, round-table, executor
src/app/api/      # REST endpoints
src/components/   # UI
.data/tasks/      # אחסון JSON מקומי למשימות
```
