import type { DrillDefinition } from '../types';

export const WEEK_6_DRILL: DrillDefinition = {
  id: 'w6-system-design-star',
  week: 6,
  title: 'Weather Data Pipeline & STAR Architecture Defense',
  tier: 1,
  engine: 'sqlite-wasm',
  language: 'json',
  targetFile: 'docs/architecture/weather_data_pipeline.json',
  conceptBrief: {
    thesis: 'High-throughput sensor networks require decoupled ingestion, partition-aware storage, and structured architectural defense. Senior engineering interviews evaluate your ability to defend trade-offs using the STAR framework under production failure scenarios.',
    diagramType: 'queue',
    keyPoints: [
      'Decoupled Ingestion: An API Gateway absorbs 100k req/sec sensor bursts by streaming into an in-memory buffer (Redis Streams/Kafka), protecting database workers from connection exhaustion.',
      'Time-Series Partitioning: Database writes are partitioned across immutable time chunks (e.g. PARTITION BY RANGE (recorded_at::date)) to prevent B-Tree index thrashing and enable fast table drop archiving.',
      'Replication Lag & Read-Your-Writes: During write bursts, read replicas lag behind primary databases. Prevent read-after-write anomalies by routing authenticated mutation reads to the primary database while serving public reads from cached replicas with max-age headers.',
      'Backpressure & Drop Policies: When sensor ingestion exceeds buffer capacity, the gateway sheds non-critical metrics and applies exponential backoff rather than crashing the cluster.',
      'Capacity Sizing Math: Assuming each database batch insert takes 50ms, one worker processes 1,000ms / 50ms = 20 batches/sec. At target ingestion of 100,000 events/sec with batchSize = 1,000 events/batch, workload demands 100 batches/sec. 100 batches/sec ÷ 20 batches/sec/worker = 5 nominal workers. Concurrency of 64 workers provides 12.8× capacity headroom for peak bursts. A 5-minute surge buffer requires capacity for 100,000 events/sec × 300s = 30,000,000 events (e.g. ~15GB assuming 500 bytes/event).',
      'STAR Framework Defense: Articulate Situation, Task, Action, and Result with quantifiable metrics (e.g. 99.99% ingestion SLA, <50ms p95 latency).',
    ],
    quiz: {
      question: 'A user publishes a post and immediately redirects to their feed, but the new post is missing. What architecture phenomenon explains this?',
      options: [
        {
          id: 'opt-a',
          label: 'Replication lag: the write went to the primary database, but the feed read was served by a replica that hasn’t synced yet.',
          isCorrect: true,
          explanation: 'Asynchronous replication introduces a lag window where read replicas serve slightly stale snapshots of the primary database.',
        },
        {
          id: 'opt-b',
          label: 'Cache stampede: concurrent requests overwhelmed the Redis cache instance.',
          isCorrect: false,
          explanation: 'A cache stampede causes high CPU or timeout errors, not stale database reads after a redirect.',
        },
        {
          id: 'opt-c',
          label: 'The primary database rolled back the write transaction after returning HTTP 200.',
          isCorrect: false,
          explanation: 'If the response returned HTTP 200, the primary transaction committed successfully.',
        },
      ],
    },
  },
  hints: [
    "Replace the 'TODO' in backpressureStrategy with a strategy such as 'exponential backoff with non-critical metric shedding' or 'buffer spilling to object store'.",
    "Replace the 'TODO' in partitionKey with a composite partition key such as 'station_code_date' or '(recorded_date, station_id)'.",
    "Ensure batchSize is numeric and set to 1000 to match the worked throughput calculation.",
    "Ensure all STAR story fields in the architecture specification or StarStoryBuilder have concrete metrics without 'TODO'.",
  ],
  initialCode: `{
  "system": "Weather Data Sensor Ingestion Pipeline",
  "targetThroughputRps": 100000,
  "ingestionSlaP95Ms": 50,
  "architecture": {
    "gateway": "Edge API Gateway with token bucket rate-limiting",
    "buffer": {
      "technology": "Redis Streams / Kafka partitioned queue",
      "backpressureStrategy": "TODO: Define backpressure strategy (e.g. dynamic sliding-window rate limit with priority shedding)"
    },
    "workers": {
      "concurrency": 64,
      "batchSize": 1000,
      "deadLetterQueue": true
    },
    "storage": {
      "database": "PostgreSQL 16.4",
      "partitionKey": "TODO: Define composite time partition key (e.g. recorded_at::date, station_id)",
      "retentionDays": 90
    }
  },
  "starStories": {
    "spikeDefense": {
      "situation": "Unprecedented typhoon caused 500k req/sec sensor burst, saturating network buffers.",
      "task": "Prevent ingestion cluster collapse and maintain zero telemetry loss for tier-1 stations.",
      "action": "TODO: Document architectural action taken (e.g. scale Redis shards, enable HTTP 429 Retry-After, batch 1000-row inserts)",
      "result": "TODO: Document measurable outcome achieved (e.g. 99.995% uptime, eliminated DB connection exhaustion, <50ms p95 latency)",
      "resultMetrics": {
        "uptimePercent": null,
        "p95LatencyMs": null
      }
    }
  }
}
`,
  solutionCode: `{
  "system": "Weather Data Sensor Ingestion Pipeline",
  "targetThroughputRps": 100000,
  "ingestionSlaP95Ms": 50,
  "architecture": {
    "gateway": "Edge API Gateway with token bucket rate-limiting",
    "buffer": {
      "technology": "Redis Streams / Kafka partitioned queue",
      "backpressureStrategy": "Dynamic sliding-window rate limit with priority shedding for non-critical telemetry"
    },
    "workers": {
      "concurrency": 64,
      "batchSize": 1000,
      "deadLetterQueue": true
    },
    "storage": {
      "database": "PostgreSQL 16.4",
      "partitionKey": "recorded_at::date, station_id",
      "retentionDays": 90
    }
  },
  "starStories": {
    "spikeDefense": {
      "situation": "Unprecedented typhoon caused 500k req/sec sensor burst, saturating network buffers.",
      "task": "Prevent ingestion cluster collapse and maintain zero telemetry loss for tier-1 stations.",
      "action": "Scaled Redis partition shards from 16 to 64, activated client backpressure headers (429 with Retry-After), and batched database writes in 1,000-row multi-value INSERT statements.",
      "result": "Maintained 99.995% ingestion uptime, eliminated database connection exhaustion, and achieved p95 ingestion latency of 34ms.",
      "resultMetrics": {
        "uptimePercent": 99.995,
        "p95LatencyMs": 34
      }
    }
  }
}
`,
  validationRules: {
    type: 'ast-property',
    expectedAssertions: [
      'Valid JSON architecture specification',
      'Buffer backpressure strategy defined',
      'Worker batch size aligned with worked sizing calculation (1000 events/batch)',
      'Time-series partition key specified',
      'STAR interview story actions and measurable results documented',
    ],
  },
  oralRubric: {
    question: 'Present your Weather Data Ingestion Pipeline architecture in 3 minutes using the STAR method, and explain how you handle a 5x sudden burst without dropping sensor telemetry.',
    checkpoints: [
      {
        dimension: 'correctness',
        prompt: 'Structured answer clearly using Situation, Task, Action, and Result with realistic, quantifiable systems metrics (throughput, latency, error rates).',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Defended trade-off between In-Memory Buffers (high throughput, risk of memory exhaustion) vs Direct Database Ingestion (immediate persistence, risk of connection pool collapse).',
      },
      {
        dimension: 'failure',
        prompt: 'Articulated failure scenarios: network partitions, Redis broker failover, PostgreSQL WAL replication lag, and poison-pill sensor payloads routed to dead-letter queues.',
      },
      {
        dimension: 'clarity',
        prompt: 'Spoke with executive confidence, avoided filler words, maintained steady pacing, and adhered to the 3-minute presentation limit.',
      },
      {
        dimension: 'challenge',
        prompt: 'Answered follow-up: "If PostgreSQL replication lag grows to 45 seconds during severe storms, how do you prevent read-after-write anomalies on the real-time weather dashboard? (Answer: Read-your-writes routing to primary for authenticated admins; cached Redis read replicas with max staleness headers for public traffic)."',
      },
    ],
  },
};

/**
 * Deterministic client evaluation for Week 6 System Design
 */
export function evaluateSystemDesignDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  let parsed: any = null;
  try {
    parsed = JSON.parse(code);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Top-level JSON must be an object.');
    }
  } catch {
    return {
      passed: false,
      queriesExecuted: 0,
      simulatedLatencyMs: 12,
      assertionResults: [
        { name: 'JSON Syntax Valid', passed: false, message: 'Code contains invalid JSON syntax or structure.' },
        { name: 'Backpressure Strategy', passed: false, message: 'Unchecked due to syntax error.' },
        { name: 'Worker Batch Size Alignment', passed: false, message: 'Unchecked due to syntax error.' },
        { name: 'Partition Key Specification', passed: false, message: 'Unchecked due to syntax error.' },
        { name: 'STAR Story Defense', passed: false, message: 'Unchecked due to syntax error.' },
      ],
    };
  }

  const isMeaningfulStringWithoutTodo = (val: unknown, minLen = 10): val is string => {
    return typeof val === 'string' && val.trim().length >= minLen && !val.includes('TODO');
  };

  const backpressureStrategy = parsed.architecture?.buffer?.backpressureStrategy;
  const backpressureMechanismRegex = /(?:rate[- ]?limit|429|503|retry[- ]?after|priority shedding|shedding|batch|partition shedding|throttl|admission control|circuit breaker|token bucket|leaky bucket|concurrency limit|bounded (?:ingress|buffer|queue)|drop|spill|queue depth|backoff|flow control|watermark|push[- ]?back|reactive|degrade|reject)/i;

  const isValidStructuredBackpressure = (val: unknown): boolean => {
    if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    const requiredKeys = ['mechanism', 'trigger', 'response'];
    if (keys.length !== 3 || !requiredKeys.every((k) => k in obj)) return false;
    const { mechanism, trigger, response } = obj;

    if (
      !isMeaningfulStringWithoutTodo(mechanism, 5) ||
      !isMeaningfulStringWithoutTodo(trigger, 5) ||
      !isMeaningfulStringWithoutTodo(response, 5)
    ) {
      return false;
    }

    return (
      backpressureMechanismRegex.test(mechanism) ||
      backpressureMechanismRegex.test(response)
    );
  };

  const hasBackpressure = Boolean(
    (isMeaningfulStringWithoutTodo(backpressureStrategy, 10) &&
      backpressureMechanismRegex.test(backpressureStrategy)) ||
    isValidStructuredBackpressure(backpressureStrategy)
  );

  const partitionKey = parsed.architecture?.storage?.partitionKey;
  const timeTokens = new Set([
    'date',
    'time',
    'timestamp',
    'timestamptz',
    'ts',
    'day',
    'week',
    'month',
    'year',
    'hour',
    'recorded',
    'created',
  ]);
  const hasTimeDimension =
    typeof partitionKey === 'string' &&
    partitionKey
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((token) => timeTokens.has(token));

  const hasPartitionKey = Boolean(
    isMeaningfulStringWithoutTodo(partitionKey, 5) && hasTimeDimension
  );

  const starAction = parsed.starStories?.spikeDefense?.action;
  const actionMechanismRegex = /(?:shard|cache|buffer|queue|batch|limit|429|503|shed|scale|index|pool|replica|partition|stream|broker|cluster|drain|worker|throttle|route|circuit|spill|offload|parallel|asynchronous|decouple|provision|isolate|failover|balance|gateway)/i;

  const isValidStructuredStarAction = (val: unknown): boolean => {
    if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    const requiredKeys = ['mechanism', 'execution'];
    if (keys.length !== 2 || !requiredKeys.every((k) => k in obj)) return false;
    const { mechanism, execution } = obj;

    if (
      !isMeaningfulStringWithoutTodo(mechanism, 10) ||
      !isMeaningfulStringWithoutTodo(execution, 10)
    ) {
      return false;
    }

    return (
      actionMechanismRegex.test(mechanism) ||
      actionMechanismRegex.test(execution)
    );
  };

  const hasStarAction = Boolean(
    (isMeaningfulStringWithoutTodo(starAction, 20) &&
      actionMechanismRegex.test(starAction)) ||
    isValidStructuredStarAction(starAction)
  );

  const starResult = parsed.starStories?.spikeDefense?.result;
  const resultUnitRegex = /(?:%|(?:ms|rps|req\/sec|events\/sec|seconds|minutes)\b)/i;

  const isValidStructuredStarResult = (val: unknown): boolean => {
    if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    const requiredKeys = ['outcome', 'evidence'];
    if (keys.length !== 2 || !requiredKeys.every((k) => k in obj)) return false;
    const { outcome, evidence } = obj;

    if (
      !isMeaningfulStringWithoutTodo(outcome, 10) ||
      !isMeaningfulStringWithoutTodo(evidence, 5)
    ) {
      return false;
    }

    return resultUnitRegex.test(evidence);
  };

  const hasStarResult = Boolean(
    (isMeaningfulStringWithoutTodo(starResult, 20) &&
      resultUnitRegex.test(starResult)) ||
    isValidStructuredStarResult(starResult)
  );

  const batchSize = parsed.architecture?.workers?.batchSize;
  const hasValidBatchSize = typeof batchSize === 'number' && batchSize === 1000;

  const metrics = parsed.starStories?.spikeDefense?.resultMetrics;
  const hasValidMetrics = Boolean(
    metrics &&
    typeof metrics === 'object' &&
    typeof metrics.uptimePercent === 'number' &&
    Number.isFinite(metrics.uptimePercent) &&
    metrics.uptimePercent >= 99.0 &&
    metrics.uptimePercent <= 100 &&
    typeof metrics.p95LatencyMs === 'number' &&
    Number.isFinite(metrics.p95LatencyMs) &&
    metrics.p95LatencyMs > 0 &&
    metrics.p95LatencyMs <= 50
  );

  const starDefensePassed = Boolean(hasStarAction && hasStarResult && hasValidMetrics);

  const passed = Boolean(hasBackpressure && hasValidBatchSize && hasPartitionKey && starDefensePassed);

  return {
    passed,
    queriesExecuted: 1,
    simulatedLatencyMs: 24,
    assertionResults: [
      {
        name: 'JSON Architecture Specification',
        passed: true,
        message: 'System architecture document parsed cleanly.',
      },
      {
        name: 'Buffer Backpressure Strategy',
        passed: Boolean(hasBackpressure),
        message: hasBackpressure
          ? `Defined: ${parsed.architecture?.buffer?.backpressureStrategy}`
          : 'Missing concrete backpressure strategy in buffer configuration (min 10 chars without TODO, must specify a recognized mechanism like rate limiting, admission control, 429 Retry-After, or priority shedding).',
      },
      {
        name: 'Worker Batch Size Alignment',
        passed: Boolean(hasValidBatchSize),
        message: hasValidBatchSize
          ? 'Configured batchSize is 1000 events, aligned with 100 batches/sec capacity calculation.'
          : `Invalid batchSize (${batchSize}); must be numeric 1000 to match worked sizing calculations.`,
      },
      {
        name: 'Time-Series Partition Key',
        passed: Boolean(hasPartitionKey),
        message: hasPartitionKey
          ? `Configured partition key: ${parsed.architecture?.storage?.partitionKey}`
          : 'Missing composite time-series partition key (must include a temporal dimension such as recorded_at, date, or timestamp).',
      },
      {
        name: 'STAR Architecture Story Defense',
        passed: starDefensePassed,
        message: starDefensePassed
          ? `STAR defense actions and quantifiable outcomes defined (uptime: ${metrics?.uptimePercent}%, p95: ${metrics?.p95LatencyMs}ms).`
          : 'Incomplete STAR story: Requires concrete architectural Action (>=20 chars with mechanism like sharding/batching), quantifiable Result (>=20 chars with units like %, ms, rps), and valid resultMetrics (finite 99.0 <= uptimePercent <= 100, 0 < p95LatencyMs <= 50).',
      },
    ],
  };
}
