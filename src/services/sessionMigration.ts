import type { DrillStepCompletions, WorkflowStep, VerificationSource } from '../types';

export interface LegacyMigrationResult {
  currentStep: WorkflowStep;
  highestStepReached: number;
  stepCompletions: DrillStepCompletions;
  drillCompleted: boolean;
  verificationSource: VerificationSource;
}

/**
 * Pure adapter that migrates a legacy drillProgress record into a full 5/5 mastery session.
 * Returns non-null ONLY when legacy?.completed === true.
 * Returns null otherwise so caller falls through to fresh-session initialization.
 */
export function migrateLegacySession(
  legacy: { completed?: boolean; verificationSource?: VerificationSource } | null | undefined
): LegacyMigrationResult | null {
  if (legacy?.completed !== true) {
    return null;
  }

  return {
    currentStep: 5,
    highestStepReached: 5,
    stepCompletions: {
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
    },
    drillCompleted: true,
    verificationSource: legacy.verificationSource ?? 'simulation',
  };
}
