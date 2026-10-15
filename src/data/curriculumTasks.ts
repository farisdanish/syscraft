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
    topics: ['Eloquent Eager Loading', 'N+1 Query Budget (≤3)', 'HTTP Lifecycle Tracer', 'Model::preventLazyLoading'],
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
    statusActiveInMvp: true,
    description: '90-minute timed CRUD sprint under pressure: enforce policy gates, defend against session fixation, and pass security audits.',
    topics: ['Policy Authorization', 'Session Regeneration', 'Role-Based Access Control', 'Timed Sprint'],
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
