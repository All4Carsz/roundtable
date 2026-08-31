export type BrainRole = "architect" | "coder" | "redteam" | "researcher";

export type BuiltinProviderId = "openai" | "anthropic" | "google" | "xai";

/** Built-in provider or custom id like `custom_abc123`. */
export type ProviderId = BuiltinProviderId | (string & {});

export interface CustomAiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Prefer this AI when resolving a built-in Round Table role. */
  assignToRole?: BrainRole | null;
  /** Speak as an extra participant at the Round Table. */
  joinRoundTable: boolean;
  /** Optional prompt when joining as an extra brain. */
  systemPrompt?: string;
  enabled: boolean;
}

export type TaskStatus =
  | "draft"
  | "round_table"
  | "planned"
  | "executing"
  | "needs_human"
  | "completed"
  | "failed"
  | "stopped";

export type EvidenceKind =
  | "syntax"
  | "schema"
  | "tests"
  | "lint"
  | "security"
  | "consistency"
  | "manual";

export type EvidenceStatus = "pass" | "fail" | "skip" | "warn";

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  defaultModel: string;
  kind: "builtin" | "custom";
  baseUrl?: string;
  assignToRole?: BrainRole | null;
  joinRoundTable?: boolean;
}

export interface BrainConfig {
  role: BrainRole;
  label: string;
  hebrewLabel: string;
  description: string;
  preferredProvider: BuiltinProviderId;
  fallbackOrder: BuiltinProviderId[];
  systemPrompt: string;
  color: string;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AuditEvent {
  id: string;
  at: string;
  type: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface BrainOpinion {
  role: BrainRole | "custom";
  /** Display name for custom Round Table guests. */
  guestName?: string;
  provider: ProviderId;
  model: string;
  summary: string;
  recommendation: string;
  risks: string[];
  openQuestions: string[];
  confidence: number;
  rawText?: string;
  usage: UsageStats;
  at: string;
}

export interface RoundTableResult {
  round: number;
  opinions: BrainOpinion[];
  agreements: string[];
  disagreements: string[];
  decision: string;
  plan: PlanStep[];
  needsHuman: boolean;
  humanReason?: string;
  usage: UsageStats;
  at: string;
}

export interface PlanStep {
  id: string;
  title: string;
  owner: BrainRole;
  details: string;
  acceptance: string;
}

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  title: string;
  detail: string;
  at: string;
}

export interface CodeProposal {
  id: string;
  title: string;
  rationale: string;
  files: Array<{
    path: string;
    action: "create" | "modify" | "delete";
    language?: string;
    content: string;
  }>;
  testsToRun: string[];
  risks: string[];
  provider: ProviderId;
  model: string;
  usage: UsageStats;
  at: string;
}

export interface ControlPlaneState {
  maxTokens: number;
  maxCostUsd: number;
  maxRounds: number;
  maxAttempts: number;
  usedTokens: number;
  usedCostUsd: number;
  rounds: number;
  attempts: number;
  loopStrikes: number;
  stopped: boolean;
  stopReason?: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  goal: string;
  workspacePath?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  controlPlane: ControlPlaneState;
  brainAssignments: Partial<Record<BrainRole, { provider: ProviderId; model: string }>>;
  roundTables: RoundTableResult[];
  proposals: CodeProposal[];
  evidence: EvidenceItem[];
  audit: AuditEvent[];
  finalSummary?: string;
}

export interface CreateTaskInput {
  title: string;
  goal: string;
  workspacePath?: string;
}
