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
    statusActiveInMvp: false,
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
    statusActiveInMvp: false,
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
    statusActiveInMvp: false,
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
    statusActiveInMvp: false,
  },
  {
    id: 'w7-crud-auth-sprint',
    week: 7,
    module: 'Security & Auth',
    title: 'Timed CRUD, Session Fixation Defense & Policy Authorization',
    tier: 3,
    engine: 'docker-postgres',
    prerequisites: ['w1-laravel-internals-n1', 'w4-btree-indexing'],
    estimatedMinutes: 90,
    statusActiveInMvp: false,
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
