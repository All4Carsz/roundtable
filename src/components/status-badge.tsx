import type { EvidenceStatus, TaskStatus } from "@/lib/types";

const statusLabel: Record<TaskStatus, string> = {
  draft: "טיוטה",
  round_table: "Round Table",
  planned: "מתוכנן",
  executing: "מבצע",
  needs_human: "צריך אדם",
  completed: "הושלם",
  failed: "נכשל",
  stopped: "נעצר",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tone =
    status === "completed"
      ? "badge-pass"
      : status === "failed" || status === "stopped"
        ? "badge-fail"
        : status === "needs_human"
          ? "badge-warn"
          : "";
  return <span className={`badge ${tone}`}>{statusLabel[status]}</span>;
}

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}
