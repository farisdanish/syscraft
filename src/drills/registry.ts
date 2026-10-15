import type { DrillDefinition } from '../types';
import { WEEK_1_DRILL, evaluateLaravelDrill } from './week1-internals';
import { WEEK_4_DRILL } from './week4-performance';
import { WEEK_6_DRILL, evaluateSystemDesignDrill } from './week6-system-design';
import { WEEK_7_DRILL, evaluateSecuritySprintDrill } from './week7-security-sprint';

export const DRILL_REGISTRY: Record<number, DrillDefinition> = {
  1: WEEK_1_DRILL,
  4: WEEK_4_DRILL,
  6: WEEK_6_DRILL,
  7: WEEK_7_DRILL,
};

export const ACTIVE_WEEKS: number[] = [1, 4, 6, 7];

export function getDrillByWeek(week: number): DrillDefinition {
  const drill = DRILL_REGISTRY[week];
  if (!drill) {
    throw new Error(`Drill for week ${week} not found in registry.`);
  }
  return drill;
}

export function getDrillById(drillId: string): DrillDefinition | undefined {
  return Object.values(DRILL_REGISTRY).find((d) => d.id === drillId);
}

export function getBridgeCommandForDrill(week: number): string | null {
  switch (week) {
    case 1:
      return 'laravel-n1-test';
    case 4:
      return 'postgres-plan-test';
    case 7:
      return 'w7-auth-sprint-test';
    default:
      return null;
  }
}

export function evaluateDrillSimulation(week: number, code: string) {
  switch (week) {
    case 1:
      return evaluateLaravelDrill(code);
    case 6:
      return evaluateSystemDesignDrill(code);
    case 7:
      return evaluateSecuritySprintDrill(code);
    default:
      return null;
  }
}
