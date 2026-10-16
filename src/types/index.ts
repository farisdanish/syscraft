/**
 * SysCraft Core Domain Types & Contracts
 */

export type ExecutionTier = 1 | 2 | 3;

export type DatabaseEngine = "sqlite-wasm" | "postgresql-docker" | "simulated-laravel";

export type WorkflowStep = 1 | 2 | 3 | 4 | 5;

// Progressive 5-Step Workflow Metadata
export interface StepMetadata {
  step: WorkflowStep;
  title: string;
  description: string;
}

export const WORKFLOW_STEPS: StepMetadata[] = [
  { step: 1, title: "Concept Brief", description: "Architectural mental model & visual diagram" },
  { step: 2, title: "Focused Drill", description: "Hands-on code or SQL query implementation" },
  { step: 3, title: "Analysis & Feedback", description: "Execution breakdown, query plan telemetry & assertion diagnostics" },
  { step: 4, title: "Scored Oral Recall", description: "Unscripted verbal defense against qualitative rubric" },
  { step: 5, title: "Tracer Replay", description: "Interactive state machine and packet step-through" },
];

// Semantic Query Plan Representation (SQLite & PostgreSQL)
export interface QueryPlanNode {
  operation: "search" | "scan" | "sort" | "subquery" | "aggregate";
  table: string;
  index?: string;
  coveringIndex?: boolean;
  detail: string;
}

export interface SemanticQueryPlanResult {
  engine: "sqlite" | "postgresql";
  engineVersion: string;
  nodes: QueryPlanNode[];
  usesFullTableScan: boolean;
  indexesUsed: string[];
  executionTimeMs?: number;
  rawExplain: string[];
}

// 5-Dimension Oral Rubric
export type RubricDimension = 
  | "correctness" 
  | "tradeoff" 
  | "failure" 
  | "clarity" 
  | "challenge";

export interface OralRubricScore {
  drillId: string;
  timestamp: string;
  dimensionScores: Record<RubricDimension, number>; // 1 - 4
  durationSeconds: number;
  unscriptedPass: boolean;
  notes: string;
}

// Operationalized Hesitation Scorecard
export interface HesitationLogItem {
  id: string;
  drillId: string;
  week: number;
  topic: string;
  timeToFirstActionSeconds: number;
  retryCount: number;
  hintsRequested: number;
  failedAssertionCount: number;
  rubricMisses: string[];
  learnerFlagged: boolean;
  createdAt: string;
  reviewedSunday: boolean;
}

// Curriculum Drill Definition
export interface DrillDefinition {
  id: string;
  week: number;
  title: string;
  tier: ExecutionTier;
  engine: DatabaseEngine;
  conceptBrief: {
    thesis: string;
    diagramType: "lifecycle" | "btree" | "queue" | "diff";
    keyPoints: string[];
  };
  initialCode: string;
  solutionCode: string;
  hints?: string[];
  language: "php" | "sql" | "json";
  targetFile: string;
  validationRules: {
    type: "semantic-query-plan" | "ast-property" | "bridge-pest-test";
    expectedAssertions: string[];
    queryBudget?: number;
    requiredIndexName?: string;
  };
  oralRubric: {
    question: string;
    checkpoints: Array<{
      dimension: RubricDimension;
      prompt: string;
    }>;
  };
}

export type VerificationSource = "simulation" | "local-runtime" | "self-reported";

export * from './tasks';
import type { TaskState, DrillSessionState, StarStory } from './tasks';

// Persistence Envelope Schema (Versioned & Prototype-Safe)
export interface ExportEnvelopeV1 {
  schemaVersion: "1.0.0";
  exportedAt: string;
  appVersion: "1.0.0";
  payload: {
    tasks?: Record<string, TaskState>;
    completedDrills: Record<string, { 
      completed: boolean; 
      score?: number; 
      verified: boolean;
      verificationSource?: VerificationSource;
    }>;
    drillSessions?: Record<string, DrillSessionState>;
    hesitations: HesitationLogItem[];
    oralScores: OralRubricScore[];
    customNotes: Record<string, string>;
  };
}

export interface ExportEnvelopeV2 {
  schemaVersion: "2.0.0";
  exportedAt: string;
  appVersion: "1.0.0";
  payload: {
    tasks?: Record<string, TaskState>;
    completedDrills: Record<string, { 
      completed: boolean; 
      score?: number; 
      verified: boolean;
      verificationSource?: VerificationSource;
    }>;
    drillSessions?: Record<string, DrillSessionState>;
    hesitations: HesitationLogItem[];
    oralScores: OralRubricScore[];
    customNotes: Record<string, string>;
  };
}

// Encrypted Export Envelope (PBKDF2-SHA-256)
export interface EncryptedExportEnvelopeV1 {
  format: "syscraft-encrypted-export";
  version: "1.0.0";
  kdf: "PBKDF2-SHA-256";
  iterations: 600000;
  saltB64: string;
  nonceB64: string;
  ciphertextB64: string;
}

// Mastery Summary Contract for Post-Drill Analysis
export interface MasteryOralScoreBreakdown {
  scores: {
    correctness: number;
    tradeoff: number;
    failure: number;
    clarity: number;
    challenge?: number;
  };
  totalPoints: number;
  maxPoints: number;
  percentage: number;
  deliveryNotes?: string;
  timestamp?: string;
}

export interface MasteryAssertionItem {
  id: string;
  name: string;
  passed: boolean;
  message?: string;
}

export interface MasteryBenchmark {
  latencyMs?: number;
  queryCount?: number;
  executionTimeMs?: number;
  reductionPercentage?: number;
}

export interface DrillMasterySummary {
  drillId: string;
  week: number;
  title: string;
  module: string;
  completedAt: string;
  tier: 1 | 2 | 3;
  verificationSource: VerificationSource;
  passed: boolean;
  assertions: MasteryAssertionItem[];
  benchmark?: MasteryBenchmark;
  oralScore?: MasteryOralScoreBreakdown;
  hintsUsed: number;
  solutionRevealed: boolean;
  pedagogicalFraming: string;
  keyInvariants: string[];
  starStory?: StarStory;
  nextWeekId: string | null;
  nextWeekNumber: number | null;
  nextWeekTitle: string | null;
  isCurriculumCompleted: boolean;
}

export * from './tasks';

