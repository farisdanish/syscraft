import type { CurriculumTask, TaskState, TaskStatus, TaskAvailability } from '../types';

export const CURRICULUM_TASKS: CurriculumTask[] = [
  {
    id: 'w1-laravel-internals-n1',
    week: 1,
    module: 'Laravel Internals',
    title: 'Laravel Request Lifecycle & Eloquent N+1 Elimination',
    tier: 2,
    engine: 'simulated-laravel',
    prerequisites: [],
    estimatedMinutes: 25,
    statusActiveInMvp: true,
    description: 'Eliminate N+1 database roundtrips using Eloquent eager loading and trace the 9-stage HTTP request lifecycle.',
    topics: ['Eloquent Eager Loading', 'N+1 Query Budget (≤3)', 'Request Lifecycle & Ingress Pipeline', 'Model::preventLazyLoading'],
    trackDomain: 'framework',
  },
  {
    id: 'w2-rest-cursor-pagination',
    week: 2,
    module: 'API Design',
    title: 'REST Cursor Pagination & RFC 9457 Problem Details',
    tier: 1,
    engine: 'wasm-sqlite',
    prerequisites: ['w1-laravel-internals-n1'],
    estimatedMinutes: 30,
    statusActiveInMvp: true,
    description: 'Implement seek-based cursor pagination for high-volume APIs and emit RFC 9457 standard problem details.',
    topics: ['Seek-based Cursors', 'RFC 9457 Problem Details', 'Opaque Tokens', 'Index Traversal'],
    trackDomain: 'api',
  },
  {
    id: 'w3-class-refactoring-di',
    week: 3,
    module: 'Clean Architecture',
    title: 'Class Refactoring, Service Container & Dependency Injection',
    tier: 3,
    engine: 'docker-postgres',
    prerequisites: ['w1-laravel-internals-n1'],
    estimatedMinutes: 30,
    statusActiveInMvp: true,
    description: 'Refactor bloated procedural code into clean services, bind contracts in Laravel IoC, and inject dependencies.',
    topics: ['Dependency Inversion', 'Service Providers', 'Constructor Injection', 'Interface Segregation'],
    trackDomain: 'clean-arch',
  },
  {
    id: 'w4-btree-indexing',
    week: 4,
    module: 'Database Performance',
    title: 'B-Tree Compound Indexing & EXPLAIN QUERY PLAN Lab',
    tier: 1,
    engine: 'wasm-sqlite',
    prerequisites: ['w1-laravel-internals-n1'],
    estimatedMinutes: 35,
    statusActiveInMvp: true,
    description: 'Engineer composite B-Tree indexes in SQLite WASM and PostgreSQL, validating execution plans with EXPLAIN.',
    topics: ['Composite B-Tree Indexes', 'EXPLAIN QUERY PLAN', 'Index Covering', 'Search vs Scan'],
    trackDomain: 'database',
  },
  {
    id: 'w5-queue-dlq-pipeline',
    week: 5,
    module: 'Async Processing',
    title: 'Resilient Queue Ingestion & Dead-Letter Backoff Pipeline',
    tier: 2,
    engine: 'simulated-laravel',
    prerequisites: ['w4-btree-indexing'],
    estimatedMinutes: 30,
    statusActiveInMvp: true,
    description: 'Construct idempotent queue consumers with exponential backoff and isolate poisonous messages in a dead-letter queue.',
    topics: ['Exponential Backoff', 'Dead-Letter Queues (DLQ)', 'Idempotency Keys', 'Worker Poisoning'],
    trackDomain: 'distributed',
  },
  {
    id: 'w6-system-design-star',
    week: 6,
    module: 'System Design',
    title: 'Weather Data Pipeline & STAR Architecture Defense',
    tier: 1,
    engine: 'wasm-sqlite',
    prerequisites: ['w4-btree-indexing'],
    estimatedMinutes: 45,
    statusActiveInMvp: true,
    description: 'Architect a 100k req/sec sensor pipeline and defend storage, buffering, and failover tradeoffs using STAR.',
    topics: ['STAR Method Defense', 'Time-Series Sharding', 'Buffer Backpressure', 'SLA/SLI Tradeoffs'],
    trackDomain: 'system-design',
  },
  {
    id: 'w7-crud-auth-sprint',
    week: 7,
    module: 'Security & Auth',
    title: 'Session Fixation Defense & Policy Authorization Gate',
    tier: 3,
    engine: 'docker-postgres',
    prerequisites: ['w1-laravel-internals-n1', 'w4-btree-indexing'],
    estimatedMinutes: 25,
    statusActiveInMvp: true,
    description: 'Enforce multi-tenant model policy gates, defend against session fixation via session regeneration, and prevent IDOR vulnerability.',
    topics: ['Policy Authorization', 'Session Regeneration', 'Role-Based Access Control', 'Timed Sprint'],
    trackDomain: 'security',
  },
];

/**
 * Resolves the real-time status of a task based on prerequisites and learner states
 */
export function resolveTaskStatus(
  task: CurriculumTask,
  taskState: TaskState | undefined,
  allStates: Record<string, TaskState>
): TaskStatus {
  // If explicitly completed, verified, or deferred, preserve stored status
  if (taskState?.status === 'verified' || taskState?.status === 'completed' || taskState?.status === 'deferred') {
    return taskState.status;
  }

  // If the module is not yet active in MVP, it is planned
  if (!task.statusActiveInMvp) {
    return 'planned';
  }

  // Check if prerequisites are satisfied
  const prereqsSatisfied = task.prerequisites.every((prereqId) => {
    const s = allStates[prereqId]?.status;
    return s === 'completed' || s === 'verified';
  });

  if (!prereqsSatisfied) {
    return 'locked';
  }

  if (taskState?.status === 'in_progress') {
    return 'in_progress';
  }

  return 'available';
}

/**
 * Resolves macroscopic UI availability for dashboard cards & launchers
 */
export function resolveTaskAvailability(
  task: CurriculumTask,
  status: TaskStatus
): TaskAvailability {
  if (status === 'locked') {
    return 'blocked';
  }
  if (!task.statusActiveInMvp || status === 'planned') {
    return 'planned';
  }
  return 'active';
}

export type FrontierKind = 'in_progress' | 'available' | 'review';
export interface FrontierAction {
  week: number;
  kind: FrontierKind;
}
export interface CtaPresentation {
  label: string;
  ariaLabel: string;
}

/**
 * Resolves the learner's active curriculum frontier.
 * Pure, total, and deterministic: always returns a valid week in [1..7].
 */
export function resolveNextActionableTask(
  tasks: CurriculumTask[],
  taskStates: Record<string, TaskState>
): FrontierAction {
  const active = tasks.filter((t) => t.statusActiveInMvp);
  const status = (t: CurriculumTask) => resolveTaskStatus(t, taskStates[t.id], taskStates);
  const mastered = (s: TaskStatus) => s === 'completed' || s === 'verified';

  // 1. Earliest uncompleted wins: among active where status in {in_progress, available}, sort by week asc
  const candidates = active
    .filter((t) => {
      const s = status(t);
      return s === 'in_progress' || s === 'available';
    })
    .sort((a, b) => a.week - b.week);

  if (candidates.length > 0) {
    const chosen = candidates[0];
    const s = status(chosen);
    return {
      week: chosen.week,
      kind: s === 'in_progress' ? 'in_progress' : 'available',
    };
  }

  // 2. All mastered: if all active tasks are mastered, return review state with derived highest week
  if (active.length > 0 && active.every((t) => mastered(status(t)))) {
    const maxWeek = Math.max(...active.map((t) => t.week));
    return { week: maxWeek, kind: 'review' };
  }

  // 3. Fallback (totality):
  // A mixed mastered + deferred state (e.g. w1-w6 mastered, w7 deferred)
  // or a state with deferred tasks falls back to earliest non-mastered non-deferred task.
  const remaining = active
    .filter((t) => !mastered(status(t)) && status(t) !== 'deferred')
    .sort((a, b) => a.week - b.week);

  if (remaining.length > 0) {
    return { week: remaining[0].week, kind: 'available' };
  }

  // 4. Ultimate fallback: guarantees totality (never returns undefined / week outside 1-7)
  return { week: 1, kind: 'available' };
}

/**
 * Produces user-facing label and accessible aria-label for curriculum launch CTAs.
 */
export function resolveCtaPresentation(
  action: FrontierAction,
  tasks: CurriculumTask[]
): CtaPresentation {
  const title = tasks.find((t) => t.week === action.week)?.title ?? '';
  const n = action.week;

  if (action.kind === 'in_progress') {
    return {
      label: `Resume Week ${n}: ${title}`,
      ariaLabel: `Resume Week ${n} workbench: ${title}`,
    };
  }

  if (action.kind === 'review') {
    return {
      label: 'Review Curriculum Mastery',
      ariaLabel: `Review curriculum mastery for Week ${n}`,
    };
  }

  if (n === 1) {
    return {
      label: `Start Week 1: ${title}`,
      ariaLabel: `Launch Week 1 workbench: ${title}`,
    };
  }

  return {
    label: `Continue to Week ${n}: ${title}`,
    ariaLabel: `Launch Week ${n} workbench: ${title}`,
  };
}

