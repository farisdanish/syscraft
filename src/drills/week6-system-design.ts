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
      'Time-Series Partitioning: Database writes are sharded across immutable time chunks to prevent B-Tree index thrashing and enable instantaneous historical data archiving.',
      'Backpressure & Drop Policies: When sensor ingestion exceeds buffer capacity, the gateway sheds non-critical metrics and applies exponential backoff rather than crashing the cluster.',
      'STAR Framework Defense: Articulate Situation, Task, Action, and Result with quantifiable metrics (e.g. 99.99% ingestion SLA, <50ms p95 latency).',
      'Defensive Cross-Examination: Confidently explain replication lag, cold-start worker recovery, and write-ahead log (WAL) saturation under interview pressure.',
    ],
  },
  initialCode: `{
  "system": "Weather Data Sensor Ingestion Pipeline",
  "targetThroughputRps": 100000,
  "ingestionSlaP95Ms": 50,
  "architecture": {
    "gateway": "Edge API Gateway with token bucket rate-limiting",
    "buffer": {
      "technology": "Redis Streams / Kafka partitioned queue",
      "backpressureStrategy": "TODO: Define backpressure strategy (shedding vs backoff)"
    },
    "workers": {
      "concurrency": 64,
      "batchSize": 500,
      "deadLetterQueue": true
    },
    "storage": {
      "database": "PostgreSQL 16.4",
      "partitionKey": "TODO: Define composite partition key",
      "retentionDays": 90
    }
  },
  "starStories": {
    "spikeDefense": {
      "situation": "Unprecedented typhoon caused 500k req/sec sensor burst, saturating network buffers.",
      "task": "Prevent ingestion cluster collapse and maintain zero telemetry loss for tier-1 stations.",
      "action": "TODO: Document architectural action taken",
      "result": "TODO: Document measurable outcome achieved"
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
      "batchSize": 500,
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
      "result": "Maintained 99.995% ingestion uptime, eliminated database connection exhaustion, and achieved p95 ingestion latency of 34ms."
    }
  }
}
`,
  validationRules: {
    type: 'ast-property',
    expectedAssertions: [
      'Valid JSON architecture specification',
      'Buffer backpressure strategy defined',
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
  } catch {
    return {
      passed: false,
      queriesExecuted: 0,
      simulatedLatencyMs: 12,
      assertionResults: [
        { name: 'JSON Syntax Valid', passed: false, message: 'Code contains invalid JSON syntax.' },
        { name: 'Backpressure Strategy', passed: false, message: 'Unchecked due to syntax error.' },
        { name: 'Partition Key Specification', passed: false, message: 'Unchecked due to syntax error.' },
        { name: 'STAR Story Defense', passed: false, message: 'Unchecked due to syntax error.' },
      ],
    };
  }

  const hasBackpressure = parsed.architecture?.buffer?.backpressureStrategy && 
    !parsed.architecture.buffer.backpressureStrategy.includes('TODO');

  const hasPartitionKey = parsed.architecture?.storage?.partitionKey &&
    !parsed.architecture.storage.partitionKey.includes('TODO');

  const hasStarAction = parsed.starStories?.spikeDefense?.action &&
    !parsed.starStories.spikeDefense.action.includes('TODO');

  const hasStarResult = parsed.starStories?.spikeDefense?.result &&
    !parsed.starStories.spikeDefense.result.includes('TODO');

  const passed = Boolean(hasBackpressure && hasPartitionKey && hasStarAction && hasStarResult);

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
          ? `Defined: ${parsed.architecture.buffer.backpressureStrategy}`
          : 'Missing backpressure mitigation strategy in buffer configuration.',
      },
      {
        name: 'Time-Series Partition Key',
        passed: Boolean(hasPartitionKey),
        message: hasPartitionKey
          ? `Configured partition key: ${parsed.architecture.storage.partitionKey}`
          : 'Missing composite time-series partition key.',
      },
      {
        name: 'STAR Architecture Story Defense',
        passed: Boolean(hasStarAction && hasStarResult),
        message: (hasStarAction && hasStarResult)
          ? 'STAR defense actions and quantifiable outcomes defined.'
          : 'Incomplete STAR story: Please detail the architectural Action taken and measurable Result achieved.',
      },
    ],
  };
}
