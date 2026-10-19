import type { DrillDefinition } from '../types';

export const WEEK_4_DRILL: DrillDefinition = {
  id: 'w4-btree-indexing',
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
      'Covering Index Architectures: An index is covering when it satisfies all projected and filtered columns without table heap lookups. In SQLite, this is achieved by appending selected columns to the compound index key: (station_code, recorded_at, temperature_c). In PostgreSQL, the INCLUDE clause: CREATE INDEX ... (station_code, recorded_at) INCLUDE (temperature_c) attaches non-key payload columns to leaf pages without swelling branch nodes or affecting index B-Tree ordering.',
      'Reading EXPLAIN Plans: SQLite reports SCAN TABLE for full heap scans and SEARCH TABLE ... USING INDEX for indexed seeks. "USE TEMP B-TREE FOR ORDER BY" means the index does not satisfy sorting and requires an expensive temporary sort.',
      'Planner Economics: Query planners avoid index seeks when match rate is high (>20% of rows). Scanning pages sequentially is faster than random index lookups for high percentages.',
    ],
    quiz: {
      question: 'Under what condition will the SQLite or PostgreSQL query planner intentionally ignore an existing index on a filtered column?',
      options: [
        {
          id: 'opt-a',
          label: 'When the filter condition has low selectivity (matches a large percentage of rows), making random page lookups costlier than a sequential scan.',
          isCorrect: true,
          explanation: 'Traversing an index requires random disk I/O to look up each table page. If >20-30% of rows match, scanning pages sequentially is significantly faster.',
        },
        {
          id: 'opt-b',
          label: 'When the table has more than 10,000 total rows stored on disk.',
          isCorrect: false,
          explanation: 'Indexes become more valuable as table size grows; row count alone never causes the optimizer to bypass an index.',
        },
        {
          id: 'opt-c',
          label: 'When the SQL query does not contain an explicit ORDER BY clause.',
          isCorrect: false,
          explanation: 'Indexes are used for filtering (WHERE) regardless of whether sorting (ORDER BY) is present.',
        },
      ],
    },
  },
  hints: [
    "Identify the columns in the WHERE and ORDER BY clauses: station_code and recorded_at.",
    "Leftmost prefix rule: Put the equality filter column (station_code) first, followed by the ordering column (recorded_at DESC).",
    "Statement format: CREATE INDEX idx_station_recorded ON weather_observations (station_code, recorded_at DESC);",
  ],
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
-- INCOMPLETE STARTER SCAFFOLD:
-- CREATE INDEX idx_station_recorded ON weather_observations (/* TODO: specify indexed column(s) */);
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
        prompt: 'Articulated the write penalty: Every additional index slows down INSERT, UPDATE, and DELETE operations. Contrasted covering index implementation across engines: SQLite appends payload columns into the key sort order, whereas PostgreSQL INCLUDE stores non-key attributes only on leaf pages to keep branch pages compact.',
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
        prompt: 'Answered follow-up: "Why might PostgreSQL choose a Sequential Scan even when an index exists?" (Low selectivity / high match rate > 20%, small table fitting in one page, or stale statistics prior to ANALYZE).',
      },
    ],
  },
};
