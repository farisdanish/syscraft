import type { ExecutionTier, VerificationSource, WorkflowStep } from './index';

export type TaskStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'verified'
  | 'deferred'
  | 'planned';

export type TaskAvailability = 'active' | 'planned' | 'blocked';

export interface CurriculumTask {
  id: string; // e.g. 'w1-laravel-internals-n1', 'w4-btree-indexing'
  week: number;
  module: string;
  title: string;
  tier: ExecutionTier;
  engine: 'wasm-sqlite' | 'simulated-laravel' | 'docker-postgres';
  prerequisites: string[]; // task IDs that must be completed/verified first
  estimatedMinutes: number;
  statusActiveInMvp: boolean; // true for Week 1 & 4; false (planned) for Weeks 2, 3, 5, 6, 7
  description?: string;
  topics?: string[];
}

export interface TaskState {
  taskId: string;
  status: TaskStatus;
  attempts: number;
  verificationSource?: VerificationSource;
  lastOpenedAt?: string;
  completedAt?: string;
}

export interface DrillStepCompletions {
  1: boolean; // conceptReviewed
  2: boolean; // drillPassed
  3: boolean; // analysisInspected
  4: boolean; // oralDefended
  5: boolean; // tracerReplayed
}

export interface StarStory {
  id: string;
  title: string;
  category: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface DrillSessionState {
  drillId: string;
  week: number;
  currentStep: WorkflowStep; // 1 | 2 | 3 | 4 | 5
  highestStepReached: number;
  stepCompletions: DrillStepCompletions;
  draftCode: string;
  testResults: unknown | null;
  tier3Result: unknown | null;
  verificationSource: VerificationSource;
  completed: boolean;
  oralDefenseCompleted: boolean;
  lastActiveAt: string;
  starStories?: StarStory[];
  hintsUsed?: number;
  solutionRevealed?: boolean;
}
