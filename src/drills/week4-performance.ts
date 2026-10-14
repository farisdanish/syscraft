import type { DrillDefinition } from '../types';

export const WEEK_4_DRILL: DrillDefinition = {
  id: 'w4-data-layer-indexes',
  week: 4,
  title: 'B-Tree Compound Indexing & EXPLAIN QUERY PLAN Optimization',
  tier: 1,
  engine: 'sqlite-wasm',
  language: 'sql',
  targetFile: 'database/indexes/weather_observations_idx.sql',
  conceptBrief: {
    thesis: 'Database engines default to full sequential scans without appropriate indexes. Compound indexes must follow the leftmost prefix rule matching WHERE and ORDER BY predicates.',
    diagramType: 'btree',
    keyPoints: [
      'Sequential Scan: The database reads every single page and row in the table (O(N) cost).',
      'B-Tree Index: Balanced tree structure allowing O(log N) logarithmic binary seek directly to matching key boundaries.',
      'Leftmost Prefix Rule: An index on (A, B) accelerates queries on (A) or (A, B), but CANNOT accelerate queries filtering only on (B).',
      'Covering Index: When an index contains all selected columns, the database avoids reading the main table pages entirely.',
      'Portability Warning: SQLite EXPLAIN outputs relational concepts (SCAN vs SEARCH); it does NOT predict PostgreSQL cost optimizer choices.',
    ],
  },
  initialCode: `-- DRILL: weather_observations table has 5,000 records.
-- Target Query:
-- SELECT id, station_code, temperature_c, recorded_at 
-- FROM weather_observations 
-- WHERE station_code = 'STN-MY-042' 
-- ORDER BY recorded_at DESC 
-- LIMIT 50;

-- Currently, this query runs as: SCAN TABLE weather_observations (O(N) Full Table Scan).
-- TASK: Write a CREATE INDEX statement named 'idx_station_recorded' on weather_observations
-- that enables indexed SEARCH and avoids temporary B-Tree sorts.

-- Write your CREATE INDEX statement below:

`,
  solutionCode: `CREATE INDEX idx_station_recorded ON weather_observations (station_code, recorded_at DESC);`,
  validationRules: {
    type: 'semantic-query-plan',
    expectedAssertions: [
      'Transitioned from SCAN TABLE to SEARCH TABLE',
      'Target index idx_station_recorded utilized',
      'Leftmost prefix matching station_code and recorded_at DESC',
      'Zero sequential scans on weather_observations',
    ],
    requiredIndexName: 'idx_station_recorded',
  },
  oralRubric: {
    question: 'Explain how B-Tree indexes work under the hood, how the query planner chooses between a scan and seek, and why compound index column order matters.',
    checkpoints: [
      {
        dimension: 'correctness',
        prompt: 'Accurately described B-Tree node traversal (root to leaf), logarithmic seek O(log N), and rowid pointer dereferencing.',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Articulated the write penalty: Every additional index slows down INSERT, UPDATE, and DELETE operations and consumes disk/memory buffer space.',
      },
      {
        dimension: 'failure',
        prompt: 'Explained index bypass scenarios: functions on columns (e.g. WHERE DATE(created_at)), leading wildcards (LIKE \'%val\'), or type mismatches preventing seek.',
      },
      {
        dimension: 'clarity',
        prompt: 'Clearly explained the leftmost prefix rule using a telephone directory analogy (sorted by Last Name then First Name).',
      },
      {
        dimension: 'challenge',
        prompt: 'Answered follow-up: "Why might PostgreSQL choose a Sequential Scan even when an index exists?" (High selectivity > 20%, small table fitting in one page, or stale statistics prior to ANALYZE).',
      },
    ],
  },
};
