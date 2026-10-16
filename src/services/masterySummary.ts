import { z } from 'zod';
import type { 
  VerificationSource, 
  DrillMasterySummary, 
  MasteryAssertionItem, 
  MasteryOralScoreBreakdown, 
  MasteryBenchmark,
  OralRubricScore,
  StarStory
} from '../types';

export const MasteryAssertionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  passed: z.boolean(),
  message: z.string().optional(),
});

export const MasteryOralScoreBreakdownSchema = z.object({
  scores: z.object({
    correctness: z.number().min(1).max(4),
    tradeoff: z.number().min(1).max(4),
    failure: z.number().min(1).max(4),
    clarity: z.number().min(1).max(4),
    challenge: z.number().min(1).max(4).optional(),
  }),
  totalPoints: z.number().min(0).max(20),
  maxPoints: z.number().min(1).max(20),
  percentage: z.number().min(0).max(100),
  deliveryNotes: z.string().optional(),
  timestamp: z.string().optional(),
});

export const MasteryBenchmarkSchema = z.object({
  latencyMs: z.number().optional(),
  queryCount: z.number().optional(),
  executionTimeMs: z.number().optional(),
  reductionPercentage: z.number().optional(),
});

export const DrillMasterySummarySchema = z.object({
  drillId: z.string(),
  week: z.number().min(1).max(7),
  title: z.string(),
  module: z.string(),
  completedAt: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']),
  passed: z.boolean(),
  assertions: z.array(MasteryAssertionItemSchema),
  benchmark: MasteryBenchmarkSchema.optional(),
  oralScore: MasteryOralScoreBreakdownSchema.optional(),
  hintsUsed: z.number().min(0),
  solutionRevealed: z.boolean(),
  pedagogicalFraming: z.string(),
  keyInvariants: z.array(z.string()),
  starStory: z.any().optional(),
  nextWeekId: z.string().nullable(),
  nextWeekNumber: z.number().nullable(),
  nextWeekTitle: z.string().nullable(),
  isCurriculumCompleted: z.boolean(),
});

export const WEEK_SYSTEM_INVARIANTS: Record<number, string[]> = {
  1: [
    'Eloquent eager loading (with()) replaces N+1 procedural queries with fixed 2-query indexed batch fetch.',
    'HTTP request lifecycle traverses 9 deterministic stages from public/index.php through pipeline middleware to response termination.',
    'Model::preventLazyLoading() enforces zero-budget regressions in CI and staging test harnesses.'
  ],
  2: [
    'Seek-based cursor pagination (WHERE id > :cursor LIMIT :size) maintains constant O(log N) index seek latency across deep pages.',
    'OFFSET pagination degrades to O(N) full index scans, saturating buffer pools and memory at scale.',
    'RFC 9457 Problem Details provide machine-readable error contracts with standard type URIs and HTTP status parity.'
  ],
  3: [
    'Dependency Inversion: High-level business logic must depend on abstractions (interfaces), never concrete driver classes.',
    'IoC Service Container bindings decouple class instantiation and singleton lifetimes from calling code.',
    'Constructor dependency injection enables 100% test isolation via mock contracts without live database dependencies.'
  ],
  4: [
    'Composite B-Tree leftmost prefix seek: Multi-column indexes satisfy equality filters and sort orders in a single tree traversal.',
    'Covering indexes eliminate heap table page reads completely via index-only scans.',
    'EXPLAIN QUERY PLAN confirms SEARCH TABLE USING INDEX and verifies elimination of temporary B-Trees for sorting.'
  ],
  5: [
    'Queue idempotency keys prevent duplicate processing upon worker crash or network retry.',
    'Exponential retry backoff prevents thundering herd load on recovering downstream services.',
    'Poison message quarantine: Exhausted retries divert payloads to Dead-Letter Queue (DLQ) without worker thread termination.'
  ],
  6: [
    'Time-series sharding partitions high-volume observation writes by ingestion epoch or geographic shard.',
    'In-memory Redis buffers absorb sudden ingest traffic bursts, decoupling ingestion from bulk database persistence.',
    'STAR structured framework: Systematically articulate Situation, Task, Architectural Action, and Quantitative Result.'
  ],
  7: [
    'Session regeneration (session()->regenerate()) on authentication eliminates session fixation attack vectors.',
    'Zero-trust policy gates: Explicitly authorize resource ownership before executing any database mutation.',
    'Mass-assignment protection and strict parameterized SQL statements neutralize remote privilege escalation.'
  ]
};

const NEXT_WEEK_MAP: Record<number, { id: string; title: string }> = {
  1: { id: 'w2-rest-cursor-pagination', title: 'REST Cursor Pagination & RFC 9457 Problem Details' },
  2: { id: 'w3-class-refactoring-di', title: 'Class Refactoring, Service Container & Dependency Injection' },
  3: { id: 'w4-btree-indexing', title: 'B-Tree Compound Indexing & EXPLAIN QUERY PLAN Lab' },
  4: { id: 'w5-queue-dlq-pipeline', title: 'Resilient Queue Ingestion & Dead-Letter Backoff Pipeline' },
  5: { id: 'w6-system-design-star', title: 'Weather Data Pipeline & STAR Architecture Defense' },
  6: { id: 'w7-crud-auth-sprint', title: 'Timed CRUD, Session Fixation Defense & Policy Authorization' },
};

export interface ComputeMasterySummaryParams {
  drillId: string;
  week: number;
  title: string;
  module: string;
  tier: 1 | 2 | 3;
  verificationSource?: VerificationSource;
  completedAt?: string;
  testResults?: {
    passed?: boolean;
    summary?: string;
    assertions?: Array<{ id: string; name: string; passed: boolean; message?: string }>;
    benchmark?: {
      latencyMs?: number;
      reductionPercentage?: number;
      queryCount?: number;
    };
    queryCount?: number;
  } | null;
  tier3Result?: {
    passed?: boolean;
    executionTimeMs?: number;
  } | null;
  oralScore?: OralRubricScore | null;
  hintsUsed?: number;
  solutionRevealed?: boolean;
  starStory?: StarStory;
}

export function computeMasterySummary(params: ComputeMasterySummaryParams): DrillMasterySummary {
  const hintsUsed = Math.max(0, params.hintsUsed ?? 0);
  const solutionRevealed = Boolean(params.solutionRevealed);
  const verificationSource = params.verificationSource ?? 'simulation';
  const completedAt = params.completedAt ?? new Date().toISOString();

  // Pedagogical framing text
  let pedagogicalFraming: string;
  if (hintsUsed === 0 && !solutionRevealed) {
    pedagogicalFraming = 'Flawless Unassisted Execution: Zero hints or reference solutions consulted. Independent conceptual mastery established.';
  } else if (!solutionRevealed) {
    pedagogicalFraming = `Scaffolding utilized for progressive learning (${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}); independent oral defense and technical assertions validated conceptual mastery.`;
  } else {
    pedagogicalFraming = 'Reference solution inspected for architectural comparison; technical assertions and oral defense completed to reinforce learning.';
  }

  // Next week progression
  const nextInfo = NEXT_WEEK_MAP[params.week];
  const isCurriculumCompleted = params.week >= 7 || !nextInfo;
  const nextWeekNumber = isCurriculumCompleted ? null : params.week + 1;
  const nextWeekId = isCurriculumCompleted ? null : nextInfo.id;
  const nextWeekTitle = isCurriculumCompleted ? null : nextInfo.title;

  // Assertions normalization
  const rawAssertions = params.testResults?.assertions ?? [];
  const assertions: MasteryAssertionItem[] = rawAssertions.length > 0 
    ? rawAssertions.map((a, idx) => ({
        id: a.id || `a_${idx + 1}`,
        name: a.name || `Assertion ${idx + 1}`,
        passed: Boolean(a.passed),
        message: a.message,
      }))
    : [
        {
          id: 'core_pass',
          name: `${params.title} Technical Requirements`,
          passed: Boolean(params.testResults?.passed ?? true),
        }
      ];

  // Benchmark metrics
  let benchmark: MasteryBenchmark | undefined;
  if (
    params.testResults?.benchmark || 
    params.testResults?.queryCount !== undefined || 
    params.tier3Result?.executionTimeMs !== undefined
  ) {
    benchmark = {
      latencyMs: params.testResults?.benchmark?.latencyMs,
      queryCount: params.testResults?.benchmark?.queryCount ?? params.testResults?.queryCount,
      executionTimeMs: params.tier3Result?.executionTimeMs,
      reductionPercentage: params.testResults?.benchmark?.reductionPercentage,
    };
  }

  // Oral rubric score breakdown
  let oralScore: MasteryOralScoreBreakdown | undefined;
  if (params.oralScore?.dimensionScores) {
    const ds = params.oralScore.dimensionScores;
    const totalPoints = ds.correctness + ds.tradeoff + ds.failure + ds.clarity;
    const maxPoints = 16;
    const percentage = Math.round((totalPoints / maxPoints) * 10000) / 100;

    oralScore = {
      scores: {
        correctness: ds.correctness,
        tradeoff: ds.tradeoff,
        failure: ds.failure,
        clarity: ds.clarity,
        challenge: ds.challenge,
      },
      totalPoints,
      maxPoints,
      percentage,
      deliveryNotes: params.oralScore.notes,
      timestamp: params.oralScore.timestamp,
    };
  }

  const keyInvariants = WEEK_SYSTEM_INVARIANTS[params.week] ?? [
    'Engineered deterministic system invariants matching production scale constraints.',
    'Validated behavior across high-concurrency and failure isolation boundaries.'
  ];

  return {
    drillId: params.drillId,
    week: params.week,
    title: params.title,
    module: params.module,
    completedAt,
    tier: params.tier,
    verificationSource,
    passed: Boolean(params.testResults?.passed ?? true),
    assertions,
    benchmark,
    oralScore,
    hintsUsed,
    solutionRevealed,
    pedagogicalFraming,
    keyInvariants,
    starStory: params.starStory,
    nextWeekId,
    nextWeekNumber,
    nextWeekTitle,
    isCurriculumCompleted,
  };
}
