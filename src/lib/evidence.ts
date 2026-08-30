import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { nanoid } from "nanoid";
import type {
  CodeProposal,
  EvidenceItem,
  RoundTableResult,
  TaskRecord,
} from "./types";
import { pushAudit } from "./store";

function item(
  kind: EvidenceItem["kind"],
  status: EvidenceItem["status"],
  title: string,
  detail: string,
): EvidenceItem {
  return {
    id: nanoid(8),
    kind,
    status,
    title,
    detail,
    at: new Date().toISOString(),
  };
}

export function evaluateRoundTableConsistency(
  result: RoundTableResult,
): EvidenceItem[] {
  const out: EvidenceItem[] = [];

  if (result.opinions.length < 2) {
    out.push(
      item(
        "consistency",
        "warn",
        "מעט מדי מוחות",
        "פחות משני מוחות השתתפו — Cognitive Diversity מוגבלת",
      ),
    );
  } else {
    out.push(
      item(
        "consistency",
        "pass",
        "Multi-Brain הופעל",
        `${result.opinions.length} מוחות שונים נתנו חוות דעת`,
      ),
    );
  }

  if (result.disagreements.length > 0) {
    out.push(
      item(
        "consistency",
        "warn",
        "מחלוקת בין מוחות",
        result.disagreements.slice(0, 3).join(" | "),
      ),
    );
  } else {
    out.push(
      item(
        "consistency",
        "pass",
        "אין מחלוקת מפורשת",
        "שים לב: הסכמה אינה Evidence. זו רק אינדיקציה.",
      ),
    );
  }

  if (result.plan.length === 0) {
    out.push(item("schema", "fail", "אין תוכנית", "ה-Round Table לא הפיק plan steps"));
  } else {
    out.push(
      item("schema", "pass", "תוכנית קיימת", `${result.plan.length} צעדים`),
    );
  }

  return out;
}

export function evaluateProposalSchema(proposal: CodeProposal): EvidenceItem[] {
  const out: EvidenceItem[] = [];

  if (!proposal.files.length) {
    out.push(item("schema", "fail", "אין קבצים בהצעה", "המפתח לא הציע שינויי קבצים"));
  } else {
    out.push(
      item("schema", "pass", "Structured proposal", `${proposal.files.length} קבצים`),
    );
  }

  for (const file of proposal.files) {
    if (!file.path || file.path.includes("..")) {
      out.push(
        item("security", "fail", "נתיב קובץ חשוד", `path לא חוקי: ${file.path}`),
      );
    }
    if (file.action !== "delete" && !file.content.trim()) {
      out.push(
        item("syntax", "warn", "קובץ ריק", `${file.path} ללא תוכן`),
      );
    }
  }

  const secretLike = proposal.files.some((f) =>
    /api[_-]?key|secret|password|BEGIN PRIVATE KEY/i.test(f.content),
  );
  if (secretLike) {
    out.push(
      item(
        "security",
        "fail",
        "חשד ל-Secrets בקוד",
        "ההצעה נראית כמכילה מפתחות/סיסמאות",
      ),
    );
  } else {
    out.push(item("security", "pass", "אין Secrets גלויים", "בדיקה סטטית בסיסית עברה"));
  }

  return out;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 60_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: 124, stdout, stderr: stderr + "\nTIMEOUT" });
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function evaluateWorkspace(
  task: TaskRecord,
): Promise<EvidenceItem[]> {
  const ws = task.workspacePath;
  if (!ws) {
    return [
      item(
        "tests",
        "skip",
        "אין Workspace",
        "לא הוגדר נתיב פרויקט — בדיקות קבצים/טסטים דולגו",
      ),
    ];
  }

  const out: EvidenceItem[] = [];
  try {
    const stat = await fs.stat(ws);
    if (!stat.isDirectory()) {
      out.push(item("tests", "fail", "Workspace אינו תיקייה", ws));
      return out;
    }
  } catch {
    out.push(item("tests", "fail", "Workspace לא נמצא", ws));
    return out;
  }

  const pkg = path.join(ws, "package.json");
  try {
    await fs.access(pkg);
    const lint = await runCommand("npm", ["run", "lint", "--if-present"], ws);
    out.push(
      item(
        "lint",
        lint.code === 0 ? "pass" : lint.code === 124 ? "warn" : "fail",
        "npm run lint",
        (lint.stdout + lint.stderr).slice(0, 1200) || `exit ${lint.code}`,
      ),
    );

    const test = await runCommand("npm", ["test", "--if-present"], ws);
    out.push(
      item(
        "tests",
        test.code === 0 ? "pass" : test.code === 124 ? "warn" : "fail",
        "npm test",
        (test.stdout + test.stderr).slice(0, 1200) || `exit ${test.code}`,
      ),
    );
  } catch (err) {
    out.push(
      item(
        "tests",
        "warn",
        "לא ניתן להריץ בדיקות",
        err instanceof Error ? err.message : String(err),
      ),
    );
  }

  return out;
}

export function appendEvidence(task: TaskRecord, items: EvidenceItem[]): void {
  task.evidence.unshift(...items);
  const failed = items.filter((i) => i.status === "fail");
  if (failed.length) {
    pushAudit(task, "evidence.fail", `${failed.length} בדיקות נכשלו`, {
      ids: failed.map((f) => f.id),
    });
  } else {
    pushAudit(task, "evidence.pass", `${items.length} Evidence items נוספו`);
  }
}

export function hasBlockingFailures(items: EvidenceItem[]): boolean {
  return items.some((i) => i.status === "fail");
}
