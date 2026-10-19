import type { RubricDimension, WorkflowStep } from '../types';
import type { DrillStepCompletions } from '../types/tasks';

export const RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  'correctness',
  'tradeoff',
  'failure',
  'clarity',
  'challenge',
] as const;

export const ORAL_PASS_THRESHOLD = 14;

/**
 * Evaluates whether Step 1 concept gate is satisfied.
 * A learner can proceed if Step 1 is already completed (e.g. legacy/rehydrated session),
 * if the drill does not require a quiz, or if the micro-quiz has been verified.
 */
export function isConceptGateSatisfied(
  conceptCompleted: boolean,
  quizPassed: boolean,
  requiresQuiz: boolean = true
): boolean {
  return conceptCompleted || !requiresQuiz || quizPassed;
}

/**
 * Checks whether all 5 oral rubric dimensions have been explicitly scored (1 - 4).
 */
export function isOralAssessmentComplete(
  scores: Partial<Record<RubricDimension, number>>
): boolean {
  return RUBRIC_DIMENSIONS.every(
    (dim) => typeof scores[dim] === 'number' && (scores[dim] as number) >= 1 && (scores[dim] as number) <= 4
  );
}

/**
 * Computes the total score and passing status for an oral recall assessment.
 * Strict pass requires all 5 dimensions scored and total >= 14 / 20.
 */
export function computeOralScore(
  scores: Partial<Record<RubricDimension, number>>
): {
  total: number;
  passed: boolean;
  missingDimensions: RubricDimension[];
} {
  const missingDimensions = RUBRIC_DIMENSIONS.filter(
    (dim) => typeof scores[dim] !== 'number' || (scores[dim] as number) < 1 || (scores[dim] as number) > 4
  );
  const total = RUBRIC_DIMENSIONS.reduce((sum, dim) => sum + (scores[dim] ?? 0), 0);
  return {
    total,
    passed: missingDimensions.length === 0 && total >= ORAL_PASS_THRESHOLD,
    missingDimensions,
  };
}

/**
 * Sequential step unlock predicate: Step N requires all steps 1..(N-1) to be completed.
 */
export function canAdvanceToStep(
  targetStep: WorkflowStep,
  stepCompletions: DrillStepCompletions
): boolean {
  if (targetStep === 1) return true;
  for (let k = 1; k < targetStep; k++) {
    if (!stepCompletions[k as WorkflowStep]) return false;
  }
  return true;
}

/**
 * Mastery prerequisite guard: Recording drill completion (Step 5 mastery)
 * strictly requires prerequisite steps 1 through 4 to be complete.
 * Setting Step 5 is the responsibility of handleCompleteMastery once this returns true.
 */
export function canCompleteMastery(
  stepCompletions: DrillStepCompletions
): boolean {
  return Boolean(
    stepCompletions[1] &&
    stepCompletions[2] &&
    stepCompletions[3] &&
    stepCompletions[4]
  );
}
